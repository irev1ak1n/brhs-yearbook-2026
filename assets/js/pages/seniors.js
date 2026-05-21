const uploadBox = document.getElementById("uploadBox");
const photoUpload = document.getElementById("photoUpload");
const fileList = document.getElementById("fileList");

const MAX_FILES = 10;

let selectedFiles = [];

uploadBox.addEventListener("click", () => {
    photoUpload.click();
});

photoUpload.addEventListener("change", () => {
    addFiles([...photoUpload.files]);
});

uploadBox.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadBox.classList.add("dragging");
});

uploadBox.addEventListener("dragleave", () => {
    uploadBox.classList.remove("dragging");
});

uploadBox.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadBox.classList.remove("dragging");

    addFiles([...e.dataTransfer.files]);
});

function addFiles(files) {
    const imageFiles = files.filter(file => file.type.startsWith("image/"));

    const availableSlots = MAX_FILES - selectedFiles.length;

    if (availableSlots <= 0) {
        alert("You can only upload 10 photos at a time.");
        return;
    }

    const filesToAdd = imageFiles.slice(0, availableSlots);

    selectedFiles = [...selectedFiles, ...filesToAdd];

    if (imageFiles.length > availableSlots) {
        alert("Only 10 photos can be selected at a time.");
    }

    showFiles();
}

function showFiles() {
    fileList.innerHTML = "";

    selectedFiles.forEach((file, index) => {
        const preview = document.createElement("div");
        preview.className = "yb-file-preview";

        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.alt = file.name;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.innerHTML = "×";
        removeBtn.className = "yb-remove-file";

        removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            selectedFiles.splice(index, 1);
            showFiles();
        });

        preview.appendChild(img);
        preview.appendChild(removeBtn);
        fileList.appendChild(preview);
    });
}