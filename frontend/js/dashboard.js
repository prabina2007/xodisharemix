const API_BASE = "https://xodisharemix-backend.onrender.com";

const form = document.getElementById("uploadForm");
const messageBox = document.getElementById("messageBox");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("xodiToken");

    if (!token) {
      messageBox.textContent = "You must login first.";
      return;
    }

    const formData = new FormData(form);

    try {
      const res = await fetch(`${API_BASE}/api/songs/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();

      if (res.ok) {
        messageBox.textContent = "Song uploaded successfully!";
        messageBox.style.color = "lime";
        form.reset();
      } else {
        messageBox.textContent = data.message || "Upload failed";
        messageBox.style.color = "red";
      }

    } catch (error) {
      console.error(error);
      messageBox.textContent = "Server error";
    }
  });
}