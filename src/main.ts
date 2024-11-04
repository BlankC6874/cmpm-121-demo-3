// todo
document.addEventListener("DOMContentLoaded", () => {
  const button = document.createElement("button");
  button.textContent = "Click me";
  button.addEventListener("click", () => {
    alert("you clicked the button!");
  });
  document.body.appendChild(button);
});
// a minor change to make github action workflow run
