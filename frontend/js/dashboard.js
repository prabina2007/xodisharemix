const API_BASE = "https://xodisharemix-backend.onrender.com";

const form = document.getElementById("uploadForm");
const messageBox = document.getElementById("messageBox");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);

    try {
      const res = await fetch(`${API_BASE}/api/songs/upload`, {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (res.ok) {
        messageBox.textContent = "Song uploaded successfully!";
        messageBox.style.color = "lime";
        form.reset();
      } else {
        messageBox.textContent = data.message || "Upload failed.";
        messageBox.style.color = "red";
      }

    } catch (err) {
      console.error(err);
      messageBox.textContent = "Server error.";
      messageBox.style.color = "red";
    }
  });
}