let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

function searchNotes(word) {
  const searchTerm = word.toLowerCase();
  return notes.filter((note) => note.text.toLowerCase().includes(searchTerm));
}

function longestNote() {
  if (notes.length === 0) {
    return null;
  }

  let longest = notes[0];
  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }
  return longest;
}

function countByCategory() {
  const counts = {};
  for (const note of notes) {
    counts[note.category] = (counts[note.category] || 0) + 1;
  }
  return counts;
}

function getSummary() {
  const counts = countByCategory();
  const categorySummary = ["personal", "work", "study"]
    .filter((category) => counts[category])
    .map((category) => `${counts[category]} ${category}`)
    .join(", ");
  const noteLabel = notes.length === 1 ? "note" : "notes";
  return `${notes.length} ${noteLabel}: ${categorySummary}.`;
}

function isDuplicate(text) {
  if (typeof text !== "string") {
    return false;
  }

  const normalizedText = text.trim().toLowerCase();
  return notes.some((note) => note.text.trim().toLowerCase() === normalizedText);
}

function addNote(text, category) {
  const normalizedText = typeof text === "string" ? text.trim() : "";
  if (normalizedText.length < 1 || normalizedText.length > 200) {
    console.log("Note not added: text must be 1-200 characters.");
    return false;
  }
  if (isDuplicate(normalizedText)) {
    console.log("Note not added: a note with that text already exists.");
    return false;
  }
  if (!["personal", "work", "study"].includes(category)) {
    console.log("Note not added: category must be personal, work, or study.");
    return false;
  }

  const nextId = Math.max(0, ...notes.map((note) => note.id)) + 1;
  notes.push({ id: nextId, text: normalizedText, category });
  console.log("Note added.");
  return true;
}

console.log("Search for 'DAY 3':", searchNotes("DAY 3")); // Expected: the Day 3 assignment note.
console.log("Search for 'astronomy':", searchNotes("astronomy")); // Expected: [].

console.log("Longest note:", longestNote()); // Expected: the project report note (id 3).
const notesBeforeEmptyLongestTest = notes;
notes = [];
console.log("Longest note with no notes:", longestNote()); // Expected: null.
notes = notesBeforeEmptyLongestTest;

console.log("Counts by category:", countByCategory()); // Expected: { personal: 2, study: 2, work: 1 }.
const notesBeforeEmptyCountTest = notes;
notes = [];
console.log("Counts with no notes:", countByCategory()); // Expected: {}.
notes = notesBeforeEmptyCountTest;

console.log("Summary:", getSummary()); // Expected: "5 notes: 2 personal, 1 work, 2 study.".
const notesBeforeSingleSummaryTest = notes;
notes = [{ id: 1, text: "Plan the week", category: "personal" }];
console.log("Single-note summary:", getSummary()); // Expected: "1 note: 1 personal.".
notes = notesBeforeSingleSummaryTest;

console.log("Is ' BUY MILK AND BREAD ' a duplicate?", isDuplicate(" BUY MILK AND BREAD ")); // Expected: true.
console.log("Is 'Walk the dog' a duplicate?", isDuplicate("Walk the dog")); // Expected: false.

console.log("Add a new note:", addNote("Pack lunch", "personal")); // Expected: logs "Note added." and returns true.
console.log("Add a duplicate:", addNote("  PACK LUNCH  ", "work")); // Expected: logs the duplicate reason and returns false.
console.log("Add empty text:", addNote("   ", "study")); // Expected: logs the text-length reason and returns false.
console.log("Add invalid category:", addNote("Review notes", "home")); // Expected: logs the category reason and returns false.