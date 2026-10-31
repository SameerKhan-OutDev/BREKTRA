// Usernames never contain @, keeping email and username sign-in unambiguous.
export const usernamePattern = /^[a-zA-Z0-9][a-zA-Z0-9._\-]{2,29}$/;
export const usernameHelp = "Use 3–30 letters, numbers, dots, underscores or hyphens; start with a letter or number.";
