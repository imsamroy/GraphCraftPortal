document.addEventListener("DOMContentLoaded", function () {
	// Add event listeners to file inputs and submit buttons
	document.querySelectorAll(".next-btn").forEach((input) => {
		input.addEventListener("click", showNextSubmissions);
	});

	for (
		let i = 0;
		i < parseInt(document.getElementById("judgingArrayLength").innerHTML);
		i++
	) {
		document.getElementById(`image-container-${i}`).style.display = "none";
	}

	document.getElementById(`image-container-0`).style.display = "block";

	// Final submit button handler
	// const finalSubmitBtn = document.getElementById("finalSubmitBtn");
	// if (finalSubmitBtn) {
	// 	finalSubmitBtn.addEventListener("click", showConfirmationModal);
	// }
});

let currentIndex = 0;
let finalScores = [];

function showNextSubmissions() {
	const score = parseInt(document.getElementById("score").value);
	const confirmScore = parseInt(
		document.getElementById("confirmScore").value,
	);

	if (score != confirmScore) {
		document.getElementById("val-alert").style.display = "block";
		return;
	}

	document.getElementById("score").value = null;
	document.getElementById("confirmScore").value = null;

	document.getElementById("val-alert").style.display = "none";

	finalScores.push(score);

	document.getElementById(`image-container-${currentIndex}`).style.display =
		"none";

	if (
		currentIndex !=
		parseInt(document.getElementById("judgingArrayLength").innerHTML) - 1
	) {
		currentIndex++;

		document.getElementById(
			`image-container-${currentIndex}`,
		).style.display = "block";
	} else {
		const form = new FormData();
		form.append("scores", JSON.stringify(finalScores));
		fetch("/submit-scores", {
			method: "POST",
			body: form,
		}).then(() => {
			window.location.href = "/view-scores";
		});
	}
}
