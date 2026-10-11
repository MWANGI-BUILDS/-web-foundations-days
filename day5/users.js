const loadButton = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusMessage = document.querySelector("#status");
const usersList = document.querySelector("#users-list");

const usersUrl = "https://jsonplaceholder.typicode.com/users";
let users = [];
let hasLoadedUsers = false;

function createDetail(label, value) {
  const detail = document.createElement("p");
  const heading = document.createElement("span");
  const text = document.createElement("span");

  heading.className = "detail-label";
  heading.textContent = label;
  text.textContent = value;
  detail.append(heading, text);
  return detail;
}

function renderUsers(list) {
  usersList.replaceChildren();

  list.forEach((user) => {
    const item = document.createElement("li");
    const name = document.createElement("h3");

    item.className = "user-entry";
    name.textContent = user.name;
    item.append(
      name,
      createDetail("Email", user.email),
      createDetail("City", user.address.city),
      createDetail("Company", user.company.name)
    );
    usersList.append(item);
  });
}

async function loadUsers() {
  loadButton.disabled = true;
  statusMessage.textContent = "Loading users...";

  try {
    const response = await fetch(usersUrl);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const loadedUsers = await response.json();
    if (!Array.isArray(loadedUsers)) {
      throw new Error("The users response was not a list.");
    }

    users = loadedUsers;
    hasLoadedUsers = true;
    renderUsers(users);
    statusMessage.textContent = users.length === 0
      ? "No users match your filter."
      : `Loaded ${users.length} users.`;
  } catch (error) {
    statusMessage.textContent = "Could not load users. Please check your connection and try again.";
  } finally {
    loadButton.disabled = false;
  }
}

loadButton.addEventListener("click", loadUsers);

filterInput.addEventListener("input", () => {
  if (!hasLoadedUsers) {
    return;
  }

  const searchText = filterInput.value.trim().toLowerCase();
  const matchingUsers = users.filter((user) => user.name.toLowerCase().includes(searchText));

  renderUsers(matchingUsers);
  statusMessage.textContent = matchingUsers.length === 0
    ? "No users match your filter."
    : `Showing ${matchingUsers.length} of ${users.length} users.`;
});