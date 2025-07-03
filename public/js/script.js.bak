document.addEventListener("DOMContentLoaded", function () {
	// Set server start time
	const startTime = new Date();
	const startTimeElement = document.getElementById("startTime");
	if (startTimeElement) {
		startTimeElement.textContent = startTime.toLocaleString();
	}

	// Initialize progress bar
	const totalCount = document.getElementById("totalCount");
	const remainingCount = document.getElementById("remainingCount");

	if (totalCount && remainingCount) {
		const total = parseInt(totalCount.textContent);
		const remaining = parseInt(remainingCount.textContent);
		updateProgressBar(remaining, total);
	}

	// Add event listeners to file inputs and submit buttons
	document.querySelectorAll(".file-input").forEach((input) => {
		input.addEventListener("change", handleFileSelect);
	});

	document.querySelectorAll(".submit-btn").forEach((button) => {
		button.addEventListener("click", handleImageSubmission);
	});

	// Final submit button handler
	const finalSubmitBtn = document.getElementById("finalSubmitBtn");
	if (finalSubmitBtn) {
		finalSubmitBtn.addEventListener("click", showConfirmationModal);
	}

	// Modal elements
	const modal = document.getElementById("confirmationModal");
	const cancelBtn = document.getElementById("cancelBtn");
	const confirmBtn = document.getElementById("confirmBtn");
	const remainingCountModal = document.getElementById("remainingCountModal");

	// Modal event handlers
	if (cancelBtn) {
		cancelBtn.addEventListener("click", () => {
			modal.style.display = "none";
		});
	}

	if (confirmBtn) {
		confirmBtn.addEventListener("click", () => {
			modal.style.display = "none";
			submitFinalForm();
		});
	}

	// Close modal when clicking outside
	window.addEventListener("click", (event) => {
		if (event.target === modal) {
			modal.style.display = "none";
		}
	});
});

function updateProgressBar(remaining, total) {
	const progressBar = document.getElementById("progressBar");
	if (progressBar && total > 0 && remaining >= 0) {
		const percentage = ((total - remaining) / total) * 100;
		progressBar.style.width = `${percentage}%`;
		progressBar.textContent = `${Math.round(percentage)}% Complete`;
	}
}

function handleFileSelect(event) {
	const input = event.target;
	const imageFilename = input.id.replace("file-", "");
	const fileNameDisplay = document.getElementById(
		`file-name-${imageFilename}`,
	);
	const submitButton = input
		.closest(".image-card")
		.querySelector(".submit-btn");

	if (input.files.length > 0) {
		fileNameDisplay.textContent = input.files[0].name;
		fileNameDisplay.style.color = "#27ae60";
		submitButton.disabled = false;
	} else {
		fileNameDisplay.textContent = "No file selected";
		fileNameDisplay.style.color = "#7f8c8d";
		submitButton.disabled = true;
	}
}

function handleImageSubmission(event) {
	const button = event.target;
	const image = button.getAttribute("data-image");
	const card = button.closest(".image-card");

	if (!image || !card) return;

	const fileInput = card.querySelector(".file-input");
	const file = fileInput.files[0];

	if (!file) {
		alert("Please upload a file before submitting");
		return;
	}

	button.disabled = true;
	button.classList.add("submitting");

	const formData = new FormData();
	formData.append("image", image);
	formData.append("submission", file);

	fetch("/submit-image", {
		method: "POST",
		body: formData,
	})
		.then((response) => response.json())
		.then((data) => {
			if (data.success) {
				showSuccessMessage();

				card.classList.add("fade-out");

				setTimeout(() => {
					card.remove();

					document.getElementById("remainingCount").textContent =
						data.remainingCount;
					document.getElementById("totalCount").textContent =
						data.totalCount;
					updateProgressBar(data.remainingCount, data.totalCount);

					if (
						data.displayedImages.length >
						document.querySelectorAll(".image-card").length
					) {
						addNewImageCard(
							data.displayedImages[
								data.displayedImages.length - 1
							],
						);
					}
				}, 300);
			} else {
				button.disabled = false;
				button.classList.remove("submitting");
				console.error("Failed to submit image:", data.error);
				alert(`Error: ${data.error || "Failed to submit image"}`);
			}
		})
		.catch((error) => {
			console.error("Error:", error);
			button.disabled = false;
			button.classList.remove("submitting");
			alert("An error occurred. Please try again.");
		});
}

function showConfirmationModal() {
	const modal = document.getElementById("confirmationModal");
	const remainingCount =
		document.getElementById("remainingCount").textContent;
	const remainingCountModal = document.getElementById("remainingCountModal");

	if (remainingCountModal) {
		remainingCountModal.textContent = remainingCount;
	}

	modal.style.display = "flex";
}

function submitFinalForm() {
	// Create a form and submit it
	const form = document.createElement("form");
	form.method = "POST";
	form.action = "/final-submit";

	document.body.appendChild(form);
	form.submit();
}

function addNewImageCard(imageFilename) {
	const container = document.getElementById("imageContainer");

	const card = document.createElement("div");
	card.className = "image-card fade-in";
	card.setAttribute("data-filename", imageFilename);

	const img = document.createElement("img");
	img.src = `/problems/${encodeURIComponent(imageFilename)}`;
	img.alt = imageFilename;

	const nameDiv = document.createElement("div");
	nameDiv.className = "image-name";
	nameDiv.textContent = imageFilename;

	const uploadContainer = document.createElement("div");
	uploadContainer.className = "file-upload-container";

	const fileInput = document.createElement("input");
	fileInput.type = "file";
	fileInput.className = "file-input";
	fileInput.id = `file-${imageFilename}`;
	fileInput.accept = "*/*";

	const uploadLabel = document.createElement("label");
	uploadLabel.htmlFor = `file-${imageFilename}`;
	uploadLabel.className = "upload-btn";
	uploadLabel.textContent = "Upload File";

	const fileNameSpan = document.createElement("span");
	fileNameSpan.className = "file-name";
	fileNameSpan.id = `file-name-${imageFilename}`;
	fileNameSpan.textContent = "No file selected";

	uploadContainer.appendChild(fileInput);
	uploadContainer.appendChild(uploadLabel);
	uploadContainer.appendChild(fileNameSpan);

	const button = document.createElement("button");
	button.className = "submit-btn";
	button.setAttribute("data-image", imageFilename);
	button.textContent = "Submit";
	button.disabled = true;

	fileInput.addEventListener("change", handleFileSelect);
	button.addEventListener("click", handleImageSubmission);

	card.appendChild(img);
	card.appendChild(nameDiv);
	card.appendChild(uploadContainer);
	card.appendChild(button);

	container.appendChild(card);

	const preloadImage = new Image();
	preloadImage.src = img.src;
}

function showSuccessMessage() {}

// Add this function
function startTimer(duration) {
	const timerElement = document.getElementById("timer");
	let remaining = Math.floor(duration / 1000); // convert to seconds
	let timerInterval;

	function updateTimer() {
		const minutes = Math.floor(remaining / 60);
		const seconds = remaining % 60;

		timerElement.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

		if (remaining <= 0) {
			clearInterval(timerInterval);
			timerElement.textContent = "00:00";
			submitFinalForm();
		} else {
			remaining--;
		}
	}

	// Initial update
	updateTimer();

	// Update every second
	timerInterval = setInterval(updateTimer, 1000);
}

// Add this to DOMContentLoaded
document.addEventListener("DOMContentLoaded", function () {
	// ... existing code ...

	// Start countdown timer
	const initialRemainingElement = document.getElementById(
		"initialRemainingTime",
	);
	if (initialRemainingElement) {
		const remainingTime = parseInt(
			initialRemainingElement.dataset.remaining,
		);
		if (remainingTime > 0) {
			startTimer(remainingTime);
		}
	}
});
