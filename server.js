const express = require("express");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const multer = require("multer");

const app = express();
const PORT = 3000;
const PROBLEMS_DIR = path.join(process.cwd(), "problems");
const SUBMISSIONS_DIR = path.join(process.cwd(), "submissions");
const SUBMISSIONS_JSON = path.join(process.cwd(), "submissions.json");

// Modify the initialization code:
function initializeApp() {
	// Create directories if they don't exist
	[PROBLEMS_DIR, SUBMISSIONS_DIR].forEach((dir) => {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
	});

	// Initialize submissions.json if it doesn't exist
	if (!fs.existsSync(SUBMISSIONS_JSON)) {
		fs.writeFileSync(SUBMISSIONS_JSON, JSON.stringify([], null, 2));
		console.log("Created submissions.json");
	}
}

initializeApp();

// Create directories if they don't exist
// [PROBLEMS_DIR, SUBMISSIONS_DIR].forEach((dir) => {
// 	if (!fs.existsSync(dir)) {
// 		fs.mkdirSync(dir);
// 		console.log(`Created directory at ${dir}`);
// 	}
// });

// FLUSH submissions.json on server start
console.log("Flushing submissions.json...");
fs.writeFileSync(SUBMISSIONS_JSON, JSON.stringify([], null, 2));
console.log("submissions.json reset to empty array");

// Configure multer for file uploads
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, SUBMISSIONS_DIR);
	},
	filename: (req, file, cb) => {
		const imageFilename = req.body.image;
		if (!imageFilename) {
			return cb(new Error("Image filename is required"));
		}

		const baseName = path.basename(
			imageFilename,
			path.extname(imageFilename),
		);
		const ext = path.extname(file.originalname);
		const newFilename = `${baseName}${ext}`;

		cb(null, newFilename);
	},
});

const upload = multer({ storage: storage });

// Set up static files - FIRST: so they don't go through session and other middlewares
app.use(express.static(path.join(__dirname, "public")));
app.use("/problems", express.static(PROBLEMS_DIR));
app.use("/submissions", express.static(SUBMISSIONS_DIR)); // Serve submitted files

// Session configuration
app.use(
	session({
		secret: "your-secret-key",
		resave: false,
		saveUninitialized: true,
		cookie: { secure: false },
	}),
);

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Timer middleware - MUST come after session middleware
app.use((req, res, next) => {
	if (req.session.testStarted && !req.session.finalSubmit) {
		const now = Date.now();

		// Initialize timer if starting test
		if (!req.session.startTime) {
			req.session.startTime = now;
			req.session.timeLimit = 45 * 60 * 1000; // 45 minutes in ms
		}

		// Calculate remaining time
		const elapsed = now - req.session.startTime;
		req.session.remainingTime = Math.max(
			0,
			req.session.timeLimit - elapsed,
		);

		// Auto-finalize if time expired
		if (req.session.remainingTime <= 0) {
			req.session.finalSubmit = true;
			// Save session and redirect to submissions
			return req.session.save((err) => {
				if (err) console.error("Session save error:", err);
				return res.redirect("/submissions");
			});
		}
	}
	next();
});

// Function to shuffle array (Fisher-Yates algorithm)
function shuffleArray(array) {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

// Middleware to handle state-based redirects
app.use((req, res, next) => {
	// If test hasn't started, only allow access to start page
	// if (
	// 	!req.session.testStarted &&
	// 	req.path !== "/start" &&
	// 	req.path !== "/css/style.css"
	// ) {
	// 	return res.redirect("/start");
	// }

	// If test has started but not finalized, redirect away from start page
	if (
		req.session.testStarted &&
		!req.session.finalSubmit &&
		req.path === "/start"
	) {
		return res.redirect("/");
	}

	// If test is finalized, redirect to submissions page
	if (
		req.session.finalSubmit &&
		req.path !== "/submissions" &&
		!req.path.startsWith("/submissions/") &&
		req.path !== "/"
	) {
		return res.redirect("/submissions");
	}

	next();
});

// Set up view engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "html");
app.engine("html", require("ejs").renderFile);

// Start page route
app.get("/start", (req, res) => {
	res.render("start", {
		title: "Start Test",
	});
});

// Start test route
app.post("/start-test", (req, res) => {
	// Initialize all session variables
	const files = fs.readdirSync(PROBLEMS_DIR);
	const pngFiles = files.filter((file) =>
		file.toLowerCase().endsWith(".png"),
	);

	req.session.testStarted = true;
	req.session.startTime = Date.now(); // Initialize timer
	req.session.timeLimit = 45 * 60 * 1000; // 45 minutes
	req.session.allImages = pngFiles;
	req.session.availableImages = shuffleArray(pngFiles);
	req.session.displayedImages = req.session.availableImages.slice(0, 4);
	req.session.finalSubmit = false;

	// Save session before redirecting
	req.session.save((err) => {
		if (err) console.error("Session save error:", err);
		res.redirect("/");
	});
});

// Main route
app.get("/", (req, res) => {
	// Initialize session if needed
	if (!req.session.availableImages && req.session.testStarted) {
		const files = fs.readdirSync(PROBLEMS_DIR);
		const pngFiles = files.filter((file) =>
			file.toLowerCase().endsWith(".png"),
		);
		req.session.allImages = pngFiles;
		req.session.availableImages = shuffleArray(pngFiles);
		req.session.displayedImages = req.session.availableImages.slice(0, 4);
		req.session.finalSubmit = false;
	}

	// Redirect to submissions if finalized
	if (req.session.finalSubmit) {
		return res.redirect("/submissions");
	}

	res.render("index", {
		title: "Image Submission",
		images: req.session.displayedImages || [],
		totalCount: req.session.allImages ? req.session.allImages.length : 0,
		remainingCount: req.session.availableImages
			? req.session.availableImages.length
			: 0,
		remainingTime: req.session.remainingTime || 0, // Add timer value
	});
});

// Helper function to read submissions safely
function readSubmissions() {
	try {
		const data = fs.readFileSync(SUBMISSIONS_JSON, "utf8");
		if (!data.trim()) return [];
		return JSON.parse(data);
	} catch (error) {
		console.error("Error reading submissions:", error);
		return [];
	}
}

// Helper function to write submissions safely
function writeSubmissions(submissions) {
	try {
		fs.writeFileSync(
			SUBMISSIONS_JSON,
			JSON.stringify(submissions, null, 2),
		);
		return true;
	} catch (error) {
		console.error("Error writing submissions:", error);
		return false;
	}
}

// API to remove an image and handle file upload
app.post("/submit-image", upload.single("submission"), (req, res) => {
	const imageToRemove = req.body.image;

	if (!imageToRemove) {
		return res.status(400).json({ error: "No image specified" });
	}

	try {
		// Log the submission
		const submissionData = {
			imageFilename: imageToRemove,
			uploadedFilename: req.file ? req.file.filename : null,
			timestamp: new Date().toISOString(),
		};

		// Append to submissions.json
		const submissions = readSubmissions();
		submissions.push(submissionData);
		const writeSuccess = writeSubmissions(submissions);

		if (!writeSuccess) {
			return res.status(500).json({ error: "Failed to save submission" });
		}

		// Remove from available images
		req.session.availableImages = req.session.availableImages.filter(
			(img) => img !== imageToRemove,
		);

		// Remove from displayed images
		req.session.displayedImages = req.session.displayedImages.filter(
			(img) => img !== imageToRemove,
		);

		// Add a new image if available
		if (
			req.session.availableImages.length >
			req.session.displayedImages.length
		) {
			const nextImage =
				req.session.availableImages[req.session.displayedImages.length];
			req.session.displayedImages.push(nextImage);
		}

		res.json({
			success: true,
			displayedImages: req.session.displayedImages,
			remainingCount: req.session.availableImages.length,
			totalCount: req.session.allImages.length,
			uploadedFile: req.file ? req.file.filename : null,
		});
	} catch (error) {
		console.error("Error submitting image:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

// Final submit route
app.post("/final-submit", (req, res) => {
	req.session.finalSubmit = true;
	// Save session before redirecting
	req.session.save((err) => {
		if (err) console.error("Session save error:", err);
		res.redirect("/submissions");
	});
});

// Route to view submissions
app.get("/submissions", (req, res) => {
	try {
		const submissions = readSubmissions();
		res.render("submissions", {
			title: "Submissions Log",
			submissions: submissions,
			totalImages: req.session.allImages
				? req.session.allImages.length
				: 0,
		});
	} catch (error) {
		console.error("Error reading submissions:", error);
		res.status(500).send("Error reading submissions");
	}
});

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
	console.log(
		`Place your PNG images in the 'problems' directory at ${PROBLEMS_DIR}`,
	);
	console.log(`Submissions saved to: ${SUBMISSIONS_DIR}`);
	console.log(`Submissions log: ${SUBMISSIONS_JSON}`);
	console.log(`Submissions.json flushed on startup`);
});

app.get("/download/:filename", (req, res) => {
	const filename = decodeURIComponent(req.params.filename); // Decode the filename
	const filePath = path.join(PROBLEMS_DIR, filename);

	if (fs.existsSync(filePath)) {
		res.download(filePath, filename, (err) => {
			if (err) {
				console.error("Download error:", err);
				res.status(500).send("Error downloading file");
			}
		});
	} else {
		res.status(404).send("File not found");
	}
});
