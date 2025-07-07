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
const JUDGE_VIEW_DIR_1 = path.join(process.cwd(), "judge-view-round-1");
const JUDGE_VIEW_DIR_2 = path.join(process.cwd(), "judge-view-round-2");
const QUALIFIERS_DIR_1 = path.join(
	process.cwd(),
	"judge-view-round-1/qualifiers.json",
);
const QUALIFIERS_DIR_2 = path.join(
	process.cwd(),
	"judge-view-round-2/qualifiers.json",
);
const DURATION = [45, 60];
const CREDENTIALS = path.join(process.cwd(), "credentials.json");

let TOTAL_TEAMS = 0;
let TEAM_LIST = [];
let FREEZE_LOGIN = false;

let CURRENT_ROUND = 0;
let TEST_STATE = "RUNNING";

let NEXT_ROUND = false;

// Modify the initialization code:
function initializeApp() {
	// Create directories if they don't exist
	[
		PROBLEMS_DIR_1,
		PROBLEMS_DIR_2,
		SUBMISSIONS_DIR_1,
		SUBMISSIONS_DIR_2,
		JUDGE_VIEW_DIR_1,
		JUDGE_VIEW_DIR_2,
	].forEach((dir) => {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
	});

	[QUALIFIERS_DIR_1, QUALIFIERS_DIR_2].forEach((file) => {
		fs.writeFileSync(file, JSON.stringify([], null, 2));
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
app.use("/judge-view-round-1", express.static(JUDGE_VIEW_DIR_1));
app.use("/judge-view-round-2", express.static(JUDGE_VIEW_DIR_2));

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

function makeFolderWithTeamName(req, teamName) {
	req.session.teamSubmissionsDir = path.join(SUBMISSIONS_DIR_1, teamName);
	let dir = req.session.teamSubmissionsDir;

	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	log(`Created submissions folder for team ${teamName} for round 1`);

	json_dir = path.join(dir, "submissions.json");

	fs.writeFileSync(json_dir, JSON.stringify([], null, 2));
	log(`Created submissions.json for team ${teamName} for round 1`);

	req.session.teamJudgingDir = path.join(JUDGE_VIEW_DIR_1, teamName);
	dir = req.session.teamJudgingDir;

	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	log(`Created judging folder for team ${teamName} for round 1`);

	return dir;
}

function makeFolderWithTeamName2(req, teamName) {
	req.session.teamSubmissionsDir = path.join(SUBMISSIONS_DIR_2, teamName);
	let dir = req.session.teamSubmissionsDir;

	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	log(`Created submissions folder for team ${teamName} for round 2`);

	json_dir = path.join(dir, "submissions.json");

	fs.writeFileSync(json_dir, JSON.stringify([], null, 2));
	log(`Created submissions.json for team ${teamName} for round 2`);

	req.session.teamJudgingDir = path.join(JUDGE_VIEW_DIR_2, teamName);
	dir = req.session.teamJudgingDir;

	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	log(`Created judging folder for team ${teamName} for round 2`);

	return dir;
}

app.post("/login", upload.none(), (req, res) => {
	if (FREEZE_LOGIN) return res.redirect("/login");

	const teamName = req.body.name;
	const password = req.body.password;

	const passList = readSubmissions(CREDENTIALS);

	if (passList[teamName] != password || teamName == "Admin")
		return redirectToCurrentState(req, res);

	TEAM_LIST.push(teamName);

	makeFolderWithTeamName(req, teamName);
	req.session.teamSubmissionsJSONDir = path.join(
		req.session.teamSubmissionsDir,
		"submissions.json",
	);
	req.session.teamName = teamName;

	TOTAL_TEAMS++;

	req.session.currentState = "/start";
	req.session.currentRound = 0;

	log(`Team ${req.session.teamName} logged in`);

	return redirectToCurrentState(req, res);
});

app.get("/start", (req, res) => {
	if (req.session.currentState == null) {
		req.session.currentState = "/login";
		return redirectToCurrentState(req, res);
	}
	if (
		req.session.currentState != null &&
		req.session.currentState != "/start"
	)
		return redirectToCurrentState(req, res);

	res.render("start", {
		title: "Start Test",
		currentRound: req.session.currentRound + 1,
		duration: DURATION[req.session.currentRound],
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
	if (req.session.currentRound >= CURRENT_ROUND)
		return redirectToCurrentState(req, res);

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
	req.session.timeLimit = DURATION[req.session.currentRound - 1] * 60 * 1000; // 45 minutes
	req.session.allImages = pngFiles;
	req.session.availableImages = shuffleArray(pngFiles);
	req.session.displayedImages = req.session.availableImages.slice(
		0,
		2 * req.session.currentRound,
	);
	req.session.finalSubmit = false;

	req.session.currentState = "/test";

	log(`Team ${req.session.teamName} started the test`);
	log(
		`Team ${req.session.teamName} is currently giving round ${req.session.currentRound}`,
	);

	return redirectToCurrentState(req, res);
});

function submitTest(req, res) {
	if (req.session.currentRound == 1) {
		req.session.currentState = "/prepare";

		log(
			`Team ${req.session.teamName} has final submitted round ${req.session.currentRound} as time ran out`,
		);

		return redirectToCurrentState(req, res);
	} else {
		req.session.currentState = "/finish";

		log(
			`Team ${req.session.teamName} has final submitted round ${req.session.currentRound} as time ran out`,
		);

		return redirectToCurrentState(req, res);
	}
}

app.use((req, res, next) => {
	if (req.session.currentState == "/test") {
		const now = Date.now();

		// Calculate remaining time
		const elapsed = now - req.session.startTime;
		req.session.remainingTime = Math.max(
			0,
			req.session.timeLimit - elapsed,
		);

		// Auto-finalize if time expired
		if (req.session.remainingTime <= 0) {
			return submitTest(req, res);
		}
	}
	next();
});

app.get("/test", (req, res) => {
	if (req.session.currentState == null) {
		req.session.currentState = "/login";
		return redirectToCurrentState(req, res);
	}
	if (req.session.currentState != null && req.session.currentState != "/test")
		return redirectToCurrentState(req, res);

	res.render("test", {
		title: "GraphCraft Round " + req.session.currentRound,
		round: req.session.currentRound == 1 ? "Round 1" : "Round 2",
		images: req.session.displayedImages || [],
		totalCount: req.session.allImages ? req.session.allImages.length : 0,
		startTime: req.session.startTime || 0,
		duration: req.session.timeLimit || 0,
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
	if (TEST_STATE != "RUNNING") {
		res.status(500).json({ error: "Test has ended" });
	}

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

		log(`Team ${req.session.teamName} submitted ${req.file.filename}`);

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
			totalCount: req.session.allImages.length,
			uploadedFile: req.file ? req.file.filename : null,
		});
	} catch (error) {
		console.error("Error submitting image:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.get("/download/:filename", (req, res) => {
	const filename = decodeURIComponent(req.params.filename); // Decode the filename

	if (req.session.currentState != "/test") res.status(403).send("Forbidden");

	const problems_dir =
		req.session.currentRound == 1 ? PROBLEMS_DIR_1 : PROBLEMS_DIR_2;

	const filePath = path.join(problems_dir, filename);

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

// Final submit route
app.post("/final-submit", (req, res) => {
	return submitTest(req, res);
});

app.get("/prepare", (req, res) => {
	if (req.session.currentState == null) {
		req.session.currentState = "/login";
		return redirectToCurrentState(req, res);
	}
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
	if (!NEXT_ROUND) return redirectToCurrentState(req, res);

	let status = true;

	TEAM_LIST.every((teamName) => {
		status = !(req.session.teamName == teamName);
		return status;
	});

	if (status) {
		req.session.currentState = "/finish";
		return redirectToCurrentState(req, res);
	}

	makeFolderWithTeamName2(req, req.session.teamName);

	req.session.teamSubmissionsJSONDir = path.join(
		req.session.teamSubmissionsDir,
		"submissions.json",
	);

	req.session.currentState = "/start";

	log(
		`Team ${req.session.teamName} is going to start round ${req.session.currentRound}`,
	);

	return redirectToCurrentState(req, res);
});

app.get("/finish", (req, res) => {
	if (req.session.currentState == null) {
		req.session.currentState = "/login";
		return redirectToCurrentState(req, res);
	}
	if (
		req.session.currentState != null &&
		req.session.currentState != "/finish"
	)
		return redirectToCurrentState(req, res);

	res.render("finish", {
		title: "Finished",
	});
});

app.get("/admin-login", (req, res) => {
	if (
		req.session.currentState != null &&
		req.session.currentState != "/admin-login"
	)
		return redirectToCurrentState(req, res);

	res.render("admin-login", {
		title: "Administrator Login",
	});
});

app.post("/admin-login", upload.none(), (req, res) => {
	password = req.body.pass;

	const passList = readSubmissions(CREDENTIALS);

	if (passList["Admin"] != password) return redirectToCurrentState(req, res);

	req.session.currentState = "/invigilation-start";
	CURRENT_ROUND = 0;

	log("Administrator logged in");

	return redirectToCurrentState(req, res);
});

app.get("/invigilation-start", (req, res) => {
	if (req.session.currentState == null) {
		req.session.currentState = "/admin-login";
		return redirectToCurrentState(req, res);
	}
	if (
		req.session.currentState != null &&
		req.session.currentState != "/invigilation-start"
	)
		return redirectToCurrentState(req, res);

	req.session.currentState = "/invigilation-start";

	log("Administrator started the test");

	res.render("invigilation-start", {
		title: "Invigilation Start",
		currentRound: CURRENT_ROUND + 1,
		duration: DURATION[CURRENT_ROUND],
	});
});

app.post("/invigilation-start-test", (req, res) => {
	CURRENT_ROUND++;
	FREEZE_LOGIN = true;

	const qualifiers_dir =
		CURRENT_ROUND == 1 ? QUALIFIERS_DIR_1 : QUALIFIERS_DIR_2;

	writeSubmissions(qualifiers_dir, TEAM_LIST);

	req.session.currentState = "/invigilation";

	log(`Administrator started round ${CURRENT_ROUND}`);

	return redirectToCurrentState(req, res);
});

app.get("/invigilation", (req, res) => {
	if (req.session.currentState == null) {
		req.session.currentState = "/admin-login";
		return redirectToCurrentState(req, res);
	}
	if (
		req.session.currentState != null &&
		req.session.currentState != "/invigilation"
	)
		return redirectToCurrentState(req, res);

	req.session.currentState = "/invigilation";

	try {
		const submissions = [];
		TEAM_LIST.forEach((teamName) => {
			const submissions_dir =
				CURRENT_ROUND == 1 ? SUBMISSIONS_DIR_1 : SUBMISSIONS_DIR_2;
			const dir = path.join(submissions_dir, teamName);
			const json_dir = path.join(dir, "submissions.json");

			const team_submissions = readSubmissions(json_dir);

			const submission = {
				teamName: teamName,
				team_submissions: team_submissions,
			};

			submissions.push(submission);
		});

		res.render("invigilation", {
			title: "Submissions Log",
			submissions: submissions,
			test_state: TEST_STATE,
			currentRound: CURRENT_ROUND,
		});
	} catch (error) {
		console.error("Error reading submissions:", error);
		res.status(500).send("Error reading submissions");
	}
});

app.post("/invigilation-end-test", (req, res) => {
	TEST_STATE = "JUDGING";

	log("Administrator ended the test and will be initiating judging");

	return redirectToCurrentState(req, res);
});

app.post("/verify", (req, res) => {
	if (TEST_STATE != "JUDGING") {
		res.status(500).send("Internal Server Error");
		return redirectToCurrentState(req, res);
	}

	let judgingArray = [];

	let rstatus = true;

	TEAM_LIST.every((teamName) => {
		const submissions_dir =
			CURRENT_ROUND == 1 ? SUBMISSIONS_DIR_1 : SUBMISSIONS_DIR_2;
		const dir = path.join(submissions_dir, teamName);
		const json_dir = path.join(dir, "submissions.json");

		const team_submissions = readSubmissions(json_dir);

		const judge_view_dir =
			CURRENT_ROUND == 1 ? JUDGE_VIEW_DIR_1 : JUDGE_VIEW_DIR_2;
		const img_dir = path.join(judge_view_dir, teamName);

		let status = true;

		team_submissions.every((submission) => {
			const baseName = path.basename(
				submission.uploadedFilename,
				path.extname(submission.uploadedFilename),
			);
			const ext = path.extname(submission.imageFilename);
			const judgement_filename = `${baseName}${ext}`;

			const judgingToken = {
				teamName: teamName,
				question: submission.imageFilename,
				solution: judgement_filename,
				score: 0,
			};

			judgingArray.push(judgingToken);

			if (!fs.existsSync(path.join(img_dir, judgement_filename))) {
				log(
					`Initiation of judging failed as ${path.join(img_dir, judgement_filename)} is missing`,
				);
				status = false;
				return false;
			}

			return true;
		});

		if (!status) rstatus = false;

		return status;
	});

	if (!rstatus) return redirectToCurrentState(req, res);

	req.session.judgingArray = shuffleArray(judgingArray);

	req.session.currentState = "/judging";

	log("Judging initiated successfully");

	return redirectToCurrentState(req, res);
});

app.get("/judging", (req, res) => {
	if (req.session.currentState == null) {
		req.session.currentState = "/admin-login";
		return redirectToCurrentState(req, res);
	}
	if (
		req.session.currentState != null &&
		req.session.currentState != "/judging"
	)
		return redirectToCurrentState(req, res);

	req.session.currentState = "/judging";

	res.render("judging", {
		title: "Judging",
		judgingArray: req.session.judgingArray,
		judgingArrayLength: req.session.judgingArray.length,
		currentRound: CURRENT_ROUND == 1 ? "round-1" : "round-2",
	});
});

app.post("/submit-scores", upload.none(), (req, res) => {
	if (TEST_STATE != "JUDGING") {
		res.status(500).send("Internal Server Error");
		return redirectToCurrentState(req, res);
	}

	const scores = JSON.parse(req.body.scores);

	const problems_dir =
		req.session.currentRound == 1 ? PROBLEMS_DIR_1 : PROBLEMS_DIR_2;

	const files = fs.readdirSync(problems_dir);
	const pngFiles = files.filter((file) =>
		file.toLowerCase().endsWith(".png"),
	);

	let finalisedScores = {};

	TEAM_LIST.forEach((teamName) => {
		let problemScores = {};

		pngFiles.forEach((fileName) => {
			problemScores[fileName] = 0;
		});

		let scores = {
			problemScores: problemScores,
			totalScore: 0,
		};

		finalisedScores[teamName] = scores;
	});

	req.session.judgingArray.forEach((judgingToken, index) => {
		judgingToken.score = parseInt(scores[index]);

		finalisedScores[judgingToken.teamName].problemScores[
			judgingToken.question
		] = judgingToken.score;
		finalisedScores[judgingToken.teamName].totalScore += judgingToken.score;
	});

	req.session.finalisedScores = finalisedScores;

	log(`Administrator has completed tallying scores`);

	req.session.currentState = "/view-scores";

	return redirectToCurrentState(req, res);
});

app.get("/view-scores", (req, res) => {
	if (req.session.currentState == null) {
		req.session.currentState = "/admin-login";
		return redirectToCurrentState(req, res);
	}
	if (
		req.session.currentState != null &&
		req.session.currentState != "/view-scores"
	)
		return redirectToCurrentState(req, res);

	req.session.currentState = "/view-scores";

	const problems_dir = CURRENT_ROUND == 1 ? PROBLEMS_DIR_1 : PROBLEMS_DIR_2;

	const files = fs.readdirSync(problems_dir);
	const pngFiles = files.filter((file) =>
		file.toLowerCase().endsWith(".png"),
	);

	let finalisedScoresArr = [];

	TEAM_LIST.forEach((teamName) => {
		const scoreToken = {
			teamName: teamName,
			problemScores: req.session.finalisedScores[teamName].problemScores,
			score: req.session.finalisedScores[teamName].totalScore,
		};

		finalisedScoresArr.push(scoreToken);
	});

	finalisedScoresArr.sort((a, b) => b.score - a.score);

	res.render("scores", {
		title: "Scores",
		questions: pngFiles,
		finalisedScores: finalisedScoresArr,
		currentRound: CURRENT_ROUND == 1 ? "round-1" : "round-2",
	});
});

app.post("/check-qualifiers", upload.none(), (req, res) => {
	if (TEST_STATE != "JUDGING") {
		res.status(500).send("Internal Server Error");
		return redirectToCurrentState(req, res);
	}

	const qualifiers_dir =
		CURRENT_ROUND == 1 ? QUALIFIERS_DIR_1 : QUALIFIERS_DIR_2;

	const qualifiers = readSubmissions(qualifiers_dir);

	log(`List of qualifiers are ${qualifiers}`);

	log(`Administrator displayed qualifiers list`);

	TEAM_LIST = qualifiers;

	req.session.currentState = "/qualifiers";

	return redirectToCurrentState(req, res);
});

app.get("/qualifiers", (req, res) => {
	if (req.session.currentState == null) {
		req.session.currentState = "/admin-login";
		return redirectToCurrentState(req, res);
	}
	if (
		req.session.currentState != null &&
		req.session.currentState != "/qualifiers"
	)
		return redirectToCurrentState(req, res);

	req.session.currentState = "/qualifiers";

	let qualifierList = [];

	TEAM_LIST.forEach((teamName) => {
		const qualifyToken = {
			teamName: teamName,
			score: req.session.finalisedScores[teamName].totalScore,
		};

		qualifierList.push(qualifyToken);
	});

	qualifierList.sort((a, b) => b.score - a.score);

	res.render("qualifiers", {
		title: "Qualifiers",
		qualifierList: qualifierList,
		currentRound: CURRENT_ROUND == 1 ? "round-1" : "round-2",
	});
});

app.post("/prepare-admin", upload.none(), (req, res) => {
	if (TEST_STATE != "JUDGING") {
		res.status(500).send("Internal Server Error");
		return redirectToCurrentState(req, res);
	}

	NEXT_ROUND = true;
	TEST_STATE = "RUNNING";

	req.session.currentState = "/invigilation-start";

	log("Administrator will start next round");

	return redirectToCurrentState(req, res);
});
