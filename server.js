const express = require("express");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const multer = require("multer");

const app = express();
const PORT = 3000;
const PROBLEMS_DIR_1 = path.join(process.cwd(), "problems-round-1");
const PROBLEMS_DIR_2 = path.join(process.cwd(), "problems-round-2");
const SUBMISSIONS_DIR_1 = path.join(process.cwd(), "submissions-round-1");
const SUBMISSIONS_DIR_2 = path.join(process.cwd(), "submissions-round-2");

let TOTAL_TEAMS = 0;

// Modify the initialization code:
function initializeApp() {
	// Create directories if they don't exist
	[
		PROBLEMS_DIR_1,
		PROBLEMS_DIR_2,
		SUBMISSIONS_DIR_1,
		SUBMISSIONS_DIR_2,
	].forEach((dir) => {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
	});
}

function log(s) {
	let time = new Date(Date.now()).toLocaleTimeString();
	console.log("[" + time + "]: " + s);
}

initializeApp();

// Configure multer for file uploads
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		const finalDir = req.session.teamSubmissionsDir;
		cb(null, finalDir);
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
		const newFilename = `${req.session.teamName}-${baseName}${ext}`;

		cb(null, newFilename);
	},
});

const upload = multer({ storage: storage });

// Set up static files - FIRST: so they don't go through session and other middlewares
app.use(express.static(path.join(__dirname, "public")));
app.use("/problems-round-1", express.static(PROBLEMS_DIR_1));
app.use("/problems-round-2", express.static(PROBLEMS_DIR_2));
app.use("/submissions-round-1", express.static(SUBMISSIONS_DIR_1));
app.use("/submissions-round-2", express.static(SUBMISSIONS_DIR_2));

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

// Set up view engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "html");
app.engine("html", require("ejs").renderFile);

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});

function redirectToCurrentState(req, res) {
	req.session.save((err) => {
		if (err) console.error("Session save error:", err);
		return res.redirect(req.session.currentState);
	});
}

app.get("/login", (req, res) => {
	if (
		req.session.currentState != null &&
		req.session.currentState != "/login"
	)
		return redirectToCurrentState(req, res);

	req.session.currentState = "/login";

	res.render("login", {
		title: "Login",
	});
});

function makeFolderWithTeamName(teamName) {
	dir = path.join(SUBMISSIONS_DIR_1, teamName);

	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	log("Created submissions folder for team " + teamName + " for round 1");

	json_dir = path.join(dir, "submissions.json");

	fs.writeFileSync(json_dir, JSON.stringify([], null, 2));
	log("Created submissions.json for team " + teamName + " for round 1");

	return dir;
}

function makeFolderWithTeamName2(teamName) {
	dir = path.join(SUBMISSIONS_DIR_2, teamName);

	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	log("Created submissions folder for team " + teamName + " for round 2");

	json_dir = path.join(dir, "submissions.json");

	fs.writeFileSync(json_dir, JSON.stringify([], null, 2));
	log("Created submissions.json for team " + teamName + " for round 2");

	return dir;
}

app.post("/login", upload.none(), (req, res) => {
	teamName = req.body.name;

	req.session.teamSubmissionsDir = makeFolderWithTeamName(teamName);
	req.session.teamSubmissionsJSONDir = path.join(
		req.session.teamSubmissionsDir,
		"submissions.json",
	);
	req.session.teamName = teamName;

	TOTAL_TEAMS++;

	req.session.currentState = "/start";
	req.session.currentRound = 0;

	log("Team " + req.session.teamName + " logged in.");

	return redirectToCurrentState(req, res);
});

app.get("/start", (req, res) => {
	if (
		req.session.currentState != null &&
		req.session.currentState != "/start"
	)
		return redirectToCurrentState(req, res);

	res.render("start", {
		title: "Start",
	});
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

app.post("/start-test", (req, res) => {
	req.session.currentRound++;

	const problems_dir =
		req.session.currentRound == 1 ? PROBLEMS_DIR_1 : PROBLEMS_DIR_2;

	// Initialize all session variables
	const files = fs.readdirSync(problems_dir);
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

	req.session.currentState = "/test";

	log("Team " + req.session.teamName + " started the test");
	log(
		"Team " +
			req.session.teamName +
			" is currently giving round " +
			req.session.currentRound,
	);

	return redirectToCurrentState(req, res);
});

app.get("/test", (req, res) => {
	if (req.session.currentState != null && req.session.currentState != "/test")
		return redirectToCurrentState(req, res);

	res.render("test", {
		title: "GraphCraft Round " + req.session.currentRound,
		round: req.session.currentRound == 1 ? "Round 1" : "Round 2",
		images: req.session.displayedImages || [],
		totalCount: req.session.allImages ? req.session.allImages.length : 0,
		remainingCount: req.session.availableImages
			? req.session.availableImages.length
			: 0,
		remainingTime: req.session.remainingTime || 0, // Add timer value
		problemDir:
			req.session.currentRound == 1
				? "problems-round-1"
				: "problems-round-2",
	});
});

// Helper function to read submissions safely
function readSubmissions(json_dir) {
	try {
		const data = fs.readFileSync(json_dir, "utf8");
		if (!data.trim()) return [];
		return JSON.parse(data);
	} catch (error) {
		console.error("Error reading submissions:", error);
		return [];
	}
}

// Helper function to write submissions safely
function writeSubmissions(json_dir, submissions) {
	try {
		fs.writeFileSync(json_dir, JSON.stringify(submissions, null, 2));
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
		const submissions = readSubmissions(req.session.teamSubmissionsJSONDir);
		submissions.push(submissionData);
		const writeSuccess = writeSubmissions(
			req.session.teamSubmissionsJSONDir,
			submissions,
		);

		log("Team " + req.session.teamName + " submitted " + req.file.filename);

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
	req.session.currentState = "/prepare";

	log(
		"Team " +
			req.session.teamName +
			" has final submitted round " +
			req.session.currentRound,
	);

	return redirectToCurrentState(req, res);
});

app.get("/prepare", (req, res) => {
	if (
		req.session.currentState != null &&
		req.session.currentState != "/prepare"
	)
		return redirectToCurrentState(req, res);

	res.render("prepare", {
		title: "Prepare",
	});
});

app.post("/next-round", (req, res) => {
	req.session.teamSubmissionsDir = makeFolderWithTeamName2(
		req.session.teamName,
	);
	req.session.teamSubmissionsJSONDir = path.join(
		req.session.teamSubmissionsDir,
		"submissions.json",
	);

	req.session.currentState = "/start";

	log(
		"Team " +
			req.session.teamName +
			" is going to start next round " +
			req.session.currentRound,
	);

	return redirectToCurrentState(req, res);
});
