let apiKey = getParam("key") ;
let assistantId = getParam("asst") || "asst_2bP9JIU6aYlumYAvb9VMf3f0";
let threadId = localStorage.getItem("savedThreadId") || null;

const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

  messageInput.addEventListener("keydown", function (event) {
    // لما يضغط Enter بدون Shift
    if (event.key === "Enter" && !event.shiftKey) {
      // التأكد إن فيه محتوى مكتوب (مش مسافات فقط)
      if (messageInput.value.trim() !== "") {
        event.preventDefault(); // يمنع عمل سطر جديد
        if (!sendBtn.disabled) {
          sendMessage(); // ينفذ الإرسال
        }
      }
    }
  });

const imageInput = document.getElementById('imageInput');
const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');

imageInput.addEventListener('change', () => {
  if (imageInput.files && imageInput.files.length) {
    fileName.textContent = imageInput.files[0].name;
  }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files.length) {
    fileName.textContent = fileInput.files[0].name;
  }
});

function getParam(name) {
  var match = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
  return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}

function appendMessage(role, htmlContent, isTemporary = false) {
  if (htmlContent.includes("<table")) {
    htmlContent = `<div class="table-wrapper">${htmlContent}</div>`;
  }

  const chatBox = document.getElementById("chatBox");
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role === 'user' ? 'user-msg' : 'assistant-msg'}`;
  bubble.innerHTML = htmlContent;
  if (isTemporary) bubble.id = "loadingMessage";

  const wrapper = document.createElement("div");
  wrapper.className = "d-flex flex-column";
  wrapper.appendChild(bubble);
  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function getImageBase64(fileId) {
  const response = await fetch(`https://api.openai.com/v1/files/${fileId}/content`, {
    headers: {
      "Authorization": `Bearer ${apiKey}`
    }
  });

  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result); // data:image/...;base64,...
    reader.readAsDataURL(blob);
  });
}

async function fetchLastMessage() {
  if (!threadId) return;

  const res = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages?order=desc&limit=1`, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2"
    }
  });

  const data = await res.json();
  const messages = data.data;
  if (messages.length === 0) return;

  const msg = messages[0];
  const role = msg.role;
  let contentHtml = "";

  for (const part of msg.content) {
    if (part.type === 'text') {

      if (part.text.annotations && part.text.annotations.length > 0) {
      part.text.annotations.forEach(ann => {
        if (ann.type === "file_path" && ann.file_path?.file_id) {
          const fileId = ann.file_path.file_id;
          const fileName = ann.text.split("/").pop() || "downloaded_file";

          // بدل الرابط المباشر نخلي الرابط يستدعي الدالة
          const jsLink = `<a href="javascript:downloadFromOpenAI('${fileId}', '${fileName}')">${fileName}</a>`;

          part.text.value = part.text.value.replace(ann.text, jsLink);
        }
      });
    }

      contentHtml += marked.parse(part.text.value);
    }
    if (part.type === 'image_file') {
      const base64Image = await getImageBase64(part.image_file.file_id);
      contentHtml += `<img src="${base64Image}" class="img-fluid rounded my-2" style="max-height:300px" />`;
    }
  }

  const loadingMsg = document.getElementById("loadingMessage");
  if (loadingMsg) loadingMsg.parentElement.remove();

  appendMessage(role, contentHtml);
}

async function sendMessage() {
  const messageText = messageInput.value.trim();
  const imageFile = document.getElementById("imageInput").files[0];
  const otherFile = document.getElementById("fileInput").files[0];
  const content = [];
  let attachments = [];

  sendBtn.disabled = true;
  sendBtn.innerHTML = `<span class="loading-icon"></span>`;

  let contentHtml = "";

  // رفع صورة من imageInput (vision)
  if (imageFile) {
    const formData = new FormData();
    formData.append("file", imageFile);
    formData.append("purpose", "vision");

    const uploadRes = await fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}` },
      body: formData
    });

    const uploadData = await uploadRes.json();
    content.push({ type: "image_file", image_file: { file_id: uploadData.id } });

    const base64Image = await getImageBase64(uploadData.id);
    contentHtml += `<img src="${base64Image}" class="img-fluid rounded my-2" style="max-height:300px" />`;
  }

  // رفع ملف عام من fileInput كـ attachment
  if (otherFile) {
    const formData = new FormData();
    formData.append("file", otherFile);
    formData.append("purpose", "assistants");

    const uploadRes = await fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}` },
      body: formData
    });

    const uploadData = await uploadRes.json();
    attachments.push({
      file_id: uploadData.id,
      tools: [{ type: "code_interpreter" }] // ممكن تغير الأداة حسب الاستخدام
    });

    contentHtml += `<div class="file-attachment my-2 p-2 border rounded bg-light">
                      📄 ${otherFile.name}
                    </div>`;
  }

  // نص الرسالة
  if (messageText !== "") {
    content.push({ type: "text", text: messageText });
    contentHtml += marked.parse(messageText);
  }

  if (content.length === 0 && attachments.length === 0) {
    sendBtn.innerText = "إرسال";
    sendBtn.disabled = messageInput.value.trim() === "";
    return;
  }

  appendMessage("user", contentHtml);
  appendMessage("assistant", "⏳ جاري المعالجة...", true);

  messageInput.value = "";
  document.getElementById("imageInput").value = "";
  document.getElementById("fileInput").value = "";
  sendBtn.disabled = true;

  // إرسال المحتوى
  let messagePayload = { role: "user", content };
  if (attachments.length > 0) {
    messagePayload.attachments = attachments;
  }

  await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2"
    },
    body: JSON.stringify(messagePayload)
  });

  // تشغيل الـ run
  const runRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2"
    },
    body: JSON.stringify({ assistant_id: assistantId })
  });

  const runData = await runRes.json();
  const runId = runData.id;
  let status = "queued";

  while (!["completed", "failed", "cancelled"].includes(status)) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const checkRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2"
      }
    });

    const checkData = await checkRes.json();
    status = checkData.status;
  }

  await fetchLastMessage();

  sendBtn.innerText = "إرسال";
  sendBtn.disabled = messageInput.value.trim() === "";
  fileName.textContent = ""
}



async function createNewThread() {
  const threadRes = await fetch("https://api.openai.com/v1/threads", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2"
    },
    body: "{}"
  });

  const threadData = await threadRes.json();
  threadId = threadData.id;
  localStorage.setItem("savedThreadId", threadId);
  document.getElementById("inputSection").style.display = "block";
  document.getElementById("newChatInputSection").style.display = "block";
  document.getElementById("newChatSection").style.display = "none";
}

if (threadId) {
  document.getElementById("inputSection").style.display = "block";
  document.getElementById("newChatInputSection").style.display = "block";
  document.getElementById("newChatSection").style.display = "none";
  fetchAllMessages();
}

messageInput.addEventListener("input", () => {
  const isEmpty = messageInput.value.trim() === "";
  const isLoading = sendBtn.querySelector(".loading-icon") !== null;
  sendBtn.disabled = isEmpty || isLoading;
});

function startNewChat() {
  const modalEl = document.getElementById("newChatModal");

  modalEl.classList.remove("show");
  modalEl.setAttribute("aria-hidden", "true");
  modalEl.removeAttribute("aria-modal");
  modalEl.style.display = "none";

  document.querySelectorAll(".modal-backdrop").forEach(el => el.remove());
  document.body.classList.remove("modal-open");
  document.body.style.paddingRight = '';
  document.body.style.overflow = '';

  document.getElementById("chatBox").innerHTML = "";
  createNewThread();
}

async function fetchAllMessages() {
  if (!threadId) return;

  const res = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages?order=desc`, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2"
    }
  });

  const data = await res.json();
  const messages = data.data;

  for (const msg of messages.reverse()) {
    const role = msg.role;
    let contentHtml = "";

    for (const part of msg.content) {
      if (part.type === 'text') {
        if (part.text.annotations && part.text.annotations.length > 0) {
      part.text.annotations.forEach(ann => {
        if (ann.type === "file_path" && ann.file_path?.file_id) {
          const fileId = ann.file_path.file_id;
          const fileName = ann.text.split("/").pop() || "downloaded_file";

          // بدل الرابط المباشر نخلي الرابط يستدعي الدالة
          const jsLink = `<a href="javascript:downloadFromOpenAI('${fileId}', '${fileName}')">${fileName}</a>`;

          part.text.value = part.text.value.replace(ann.text, jsLink);
        }
      });
    }
        
        contentHtml += marked.parse(part.text.value);
      }
      if (part.type === 'image_file') {
        const base64Image = await getImageBase64(part.image_file.file_id);
        contentHtml += `<img src="${base64Image}" class="img-fluid rounded my-2" style="max-height:300px" />`;
      }
    }

    appendMessage(role, contentHtml);
  }
}


function downloadFromOpenAI(fileId, fileName) {
  fetch(`https://api.openai.com/v1/files/${fileId}/content`, {
    headers: {
      Authorization: `Bearer ${apiKey}` // خليها من السيرفر أو env
    }
  })
  .then(res => {
    if (!res.ok) throw new Error("Download failed");
    return res.blob();
  })
  .then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  })
  .catch(err => {
    console.error("Error downloading file:", err);
  });
}
