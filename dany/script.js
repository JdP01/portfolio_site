const introScreen = document.getElementById("intro-screen");
const openLetterButton = document.getElementById("open-letter");
const pageShell = document.getElementById("anniversary-page");

if (introScreen && openLetterButton && pageShell) {
	openLetterButton.addEventListener("click", () => {
		introScreen.classList.add("ready");

		window.setTimeout(() => {
			introScreen.classList.add("hidden");
			pageShell.classList.add("revealed");
		}, 850);
	});
}