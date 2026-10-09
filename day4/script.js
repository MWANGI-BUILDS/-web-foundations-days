const noteText = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearButton = document.querySelector("#clear-btn");
const themeToggle = document.querySelector("#theme-toggle");

const draftKey = "quicknotes-day4-draft";
const themeKey = "quicknotes-day4-theme";

function updateCounts() {
  const text = noteText.value;
  const characterTotal = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  charCount.textContent = `${characterTotal} / 200 characters`;
  wordCount.textContent = `${words} ${words === 1 ? "word" : "words"}`;
  charCount.classList.toggle("warning", characterTotal > 180 && characterTotal <= 200);
  charCount.classList.toggle("over", characterTotal > 200);
}

function clearNote() {
  noteText.value = "";
  localStorage.removeItem(draftKey);
  updateCounts();
}

function updateThemeLabel() {
  themeToggle.textContent = document.body.classList.contains("dark") ? "Light mode" : "Dark mode";
}

noteText.addEventListener("input", () => {
  updateCounts();
  localStorage.setItem(draftKey, noteText.value);
});

clearButton.addEventListener("click", clearNote);

noteText.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearNote();
  }
});

themeToggle.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark");
  localStorage.setItem(themeKey, isDark ? "dark" : "light");
  updateThemeLabel();
});

const savedDraft = localStorage.getItem(draftKey);
if (savedDraft !== null) {
  noteText.value = savedDraft;
}

if (localStorage.getItem(themeKey) === "dark") {
  document.body.classList.add("dark");
}

updateThemeLabel();
updateCounts();