const video = document.getElementById("introVideo");
const fade = document.getElementById("fade");

video.onended = () => {
  fade.style.opacity = 1;

  setTimeout(() => {
    window.location.href = "brique.html";
  }, 1500);
};
