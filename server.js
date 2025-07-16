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

let TEAM_TIMERS = {}; // { teamName: { startTime, timeLimit } }

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

    const baseName = path.basename(imageFilename, path.extname(imageFilename));
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
  if (req.session.currentState != null && req.session.currentState != "/login")
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
  const memberRole = req.body.memberRole; // "A" or "B"

  const passList = readSubmissions(CREDENTIALS);

  if (passList[teamName] != password || teamName == "Admin") {
    return redirectToCurrentState(req, res);
  }

  if (!TEAM_LIST.includes(teamName)) {
    TEAM_LIST.push(teamName);
  }

  // Create team folder if not exists (only for round 1 initially)
  makeFolderWithTeamName(req, teamName);
  req.session.teamName = teamName;
  req.session.memberRole = memberRole;
  req.session.currentRound = CURRENT_ROUND; // Set to the actual current round

  // REDIRECT TO START PAGE, NOT TEST!
  req.session.currentState = "/start";
  res.redirect("/start");
});

app.get("/start", (req, res) => {
  // Prevent starting if admin hasn't started the round
  if (CURRENT_ROUND === 0 || !FREEZE_LOGIN) {
    return res.render("start", {
      title: "Start Test",
      currentRound: 0,
      duration: 0,
      memberRole: req.session.memberRole,
      teamName: req.session.teamName,
      notStarted: true,
    });
  }
  req.session.currentState = "/start";
  res.render("start", {
    title: "Start Test",
    currentRound: req.session.currentRound,
    duration: DURATION[req.session.currentRound - 1] || 45,
    memberRole: req.session.memberRole,
    teamName: req.session.teamName,
    notStarted: false,
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
  if (
    !req.session.teamName ||
    !req.session.memberRole
  ) {
    req.session.currentState = "/login";
    return redirectToCurrentState(req, res);
  }

  // Update current round to match the global current round
  req.session.currentRound = CURRENT_ROUND;

  // Handle problem splitting based on the current round
  const submissions_dir = CURRENT_ROUND === 1 ? SUBMISSIONS_DIR_1 : SUBMISSIONS_DIR_2;
  const teamSubmissionsDir = path.join(submissions_dir, req.session.teamName);
  req.session.teamSubmissionsDir = teamSubmissionsDir;

  // Ensure the team submissions directory exists for the current round
  if (!fs.existsSync(teamSubmissionsDir)) {
    fs.mkdirSync(teamSubmissionsDir, { recursive: true });
  }

  // Setup judging directory as well
  const judge_view_dir = CURRENT_ROUND === 1 ? JUDGE_VIEW_DIR_1 : JUDGE_VIEW_DIR_2;
  const teamJudgingDir = path.join(judge_view_dir, req.session.teamName);
  req.session.teamJudgingDir = teamJudgingDir;

  if (!fs.existsSync(teamJudgingDir)) {
    fs.mkdirSync(teamJudgingDir, { recursive: true });
  }

  // Path for problem split
  const splitPath = path.join(teamSubmissionsDir, "problem_split.json");

  let split;
  if (!fs.existsSync(splitPath)) {
    // First member to log in: split and save
    const problems_dir = CURRENT_ROUND === 1 ? PROBLEMS_DIR_1 : PROBLEMS_DIR_2;
    const files = fs.readdirSync(problems_dir);
    const pngFiles = files.filter((file) =>
      file.toLowerCase().endsWith(".png"),
    );
    
    console.log(`Found ${pngFiles.length} PNG files for round ${CURRENT_ROUND}:`, pngFiles);
    
    if (pngFiles.length === 0) {
      console.error(`No PNG files found in ${problems_dir}`);
      return res.status(500).send("No problems found for this round");
    }
    
    const shuffled = shuffleArray(pngFiles);
    const half = Math.floor(shuffled.length / 2);
    split = {
      memberA: shuffled.slice(0, half),
      memberB: shuffled.slice(half),
    };
    fs.writeFileSync(splitPath, JSON.stringify(split, null, 2));
    console.log(`Created problem split for team ${req.session.teamName}:`, split);
  } else {
    // Already split, just load
    split = JSON.parse(fs.readFileSync(splitPath));
    console.log(`Loaded existing problem split for team ${req.session.teamName}:`, split);
  }

  req.session.assignedProblems =
    split[req.session.memberRole === "A" ? "memberA" : "memberB"];
  
  req.session.teamSubmissionsJSONDir = path.join(
    teamSubmissionsDir,
    "submissions.json",
  );

  // Create submissions.json if it doesn't exist
  if (!fs.existsSync(req.session.teamSubmissionsJSONDir)) {
    fs.writeFileSync(req.session.teamSubmissionsJSONDir, JSON.stringify([], null, 2));
    console.log(`Created submissions.json for team ${req.session.teamName} for round ${CURRENT_ROUND}`);
  }

  // Initialize all session variables for the test
  req.session.testStarted = true;
  req.session.startTime = Date.now(); // Initialize timer
  req.session.timeLimit =
    (DURATION[req.session.currentRound - 1] || 45) * 60 * 1000; // fallback to 45 min
  req.session.finalSubmit = false;
  req.session.currentState = "/test";

  // Set up team timer for admin dashboard
  TEAM_TIMERS[req.session.teamName + "_" + req.session.memberRole] = {
    startTime: req.session.startTime,
    timeLimit: req.session.timeLimit,
  };
  log(`Member ${req.session.memberRole} of team ${req.session.teamName} started round ${req.session.currentRound}`);

  return redirectToCurrentState(req, res);
});

function submitTest(req, res) {
  // Removing the team's timer BEFORE redirecting
  delete TEAM_TIMERS[req.session.teamName + "_" + req.session.memberRole];

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
    req.session.remainingTime = Math.max(0, req.session.timeLimit - elapsed);

    // Auto-finalize if time expired
    if (req.session.remainingTime <= 0) {
      return submitTest(req, res);
    }
  }
  next();
});

app.get("/test", (req, res) => {
  if (
    !req.session.teamName ||
    !req.session.memberRole ||
    !req.session.assignedProblems ||
    !req.session.testStarted
  ) {
    return res.redirect("/login");
  }
  
  // Add some logging to debug
  console.log("Team:", req.session.teamName, "Role:", req.session.memberRole);
  console.log("Assigned problems:", req.session.assignedProblems);
  console.log("Problem dir:", req.session.currentRound === 1 ? "problems-round-1" : "problems-round-2");
  
  res.render("test", {
    title: "GraphCraft Test",
    assignedProblems: req.session.assignedProblems || [],
    problemDir: req.session.currentRound === 1 ? "problems-round-1" : "problems-round-2",
    startTime: req.session.startTime || Date.now(),
    duration: req.session.timeLimit || (45 * 60 * 1000),
    totalCount: (req.session.assignedProblems || []).length,
    memberRole: req.session.memberRole,
    teamName: req.session.teamName,
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
    return res.status(500).json({ error: "Test has ended" });
  }

  const imageToRemove = req.body.image;

  if (!imageToRemove) {
    return res.status(400).json({ error: "No image specified" });
  }

  // Only allow submission for assigned problems
  if (!req.session.assignedProblems.includes(imageToRemove)) {
    return res.status(403).json({ error: "Not your assigned problem" });
  }

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

  if (!writeSuccess) {
    return res.status(500).json({ error: "Failed to save submission" });
  }

  res.json({
    success: true,
    uploadedFile: req.file ? req.file.filename : null,
  });
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
  // Remove timer for this member
  delete TEAM_TIMERS[req.session.teamName + "_" + req.session.memberRole];
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
  req.session.currentRound = CURRENT_ROUND; // Update to current round

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
  if (req.session.currentState != null && req.session.currentState != "/finish")
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

app.get("/api/team-timers", (req, res) => {
  // Only allow admin to access
  if (
    req.session.currentState !== "/invigilation" &&
    req.session.currentState !== "/invigilation-start"
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const now = Date.now();
  const timers = Object.entries(TEAM_TIMERS).map(
    ([teamName, { startTime, timeLimit }]) => {
      const elapsed = now - startTime;
      const remaining = Math.max(timeLimit - elapsed, 0);
      return { teamName, remainingTime: remaining };
    },
  );

  res.json(timers);
});

// Add missing test-status endpoint
app.get("/test-status", (req, res) => {
  res.json({ 
    started: CURRENT_ROUND > 0 && FREEZE_LOGIN,
    currentRound: CURRENT_ROUND 
  });
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
  const pngFiles = files.filter((file) => file.toLowerCase().endsWith(".png"));

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
  const pngFiles = files.filter((file) => file.toLowerCase().endsWith(".png"));

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
