let apiKey = getParam("key");
let assistantId = getParam("asst") || "asst_2bP9JIU6aYlumYAvb9VMf3f0";
let threadId = localStorage.getItem("savedThreadId") || null;

const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

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
  const content = [];

  sendBtn.disabled = true;
  sendBtn.innerHTML = `<span class="loading-icon"></span>`;

  let contentHtml = "";
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

  if (messageText !== "") {
    content.push({ type: "text", text: messageText });
    contentHtml += marked.parse(messageText);
  }

  if (content.length === 0) return;

  appendMessage("user", contentHtml);
  appendMessage("assistant", "⏳ جاري المعالجة...", true);

  messageInput.value = "";
  document.getElementById("imageInput").value = "";
  sendBtn.disabled = true;

  await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2"
    },
    body: JSON.stringify({ role: "user", content })
  });

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
