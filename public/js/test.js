document.addEventListener("DOMContentLoaded", function () {
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

	const form = new FormData();
	form.append("image", image);
	form.append("submission", file);

	fetch("/submit-image", {
		method: "POST",
		body: form,
	})
		.then((response) => response.json())
		.then((data) => {
			if (data.success) {
				// showSuccessMessage();

				card.classList.add("fade-out");

				setTimeout(() => {
					card.remove();

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

function addNewImageCard(imageFilename) {
	const container = document.getElementById("imageContainer");

	const card = document.createElement("div");
	card.className = "image-card fade-in";
	card.setAttribute("data-filename", imageFilename);

	const img = document.createElement("img");
	img.src = `/${document.getElementById("problemDir").innerHTML}/${encodeURIComponent(imageFilename)}`;
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

function showConfirmationModal() {
	const modal = document.getElementById("confirmationModal");
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
