let apiKey = getParam("key")
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
  msg.content.forEach(part => {
    if (part.type === 'text') contentHtml += marked.parse(part.text.value);
    if (part.type === 'image_file') {
      const fileId = part.image_file.file_id;
      const imageUrl = `https://api.openai.com/v1/files/${fileId}/content`;
      contentHtml += `<img src="${imageUrl}" class="img-fluid rounded my-2" style="max-height:300px" />`;
    }
  });
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
    formData.append("purpose", "assistants");
    const uploadRes = await fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}` },
      body: formData
    });
    const uploadData = await uploadRes.json();
    content.push({ type: "image_file", image_file: { file_id: uploadData.id } });
    contentHtml += `<img src="https://api.openai.com/v1/files/${uploadData.id}/content" class="img-fluid rounded my-2" style="max-height:300px" />`;
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

  // رجّع شكل الزر بعد المعالجة
  sendBtn.innerText = "إرسال";
  sendBtn.disabled = messageInput.value.trim() === "";
}

// إنشاء محادثة جديدة
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

// عرض واجهة الكتابة إذا كان فيه محادثة محفوظة
if (threadId) {
  document.getElementById("inputSection").style.display = "block";
  document.getElementById("newChatInputSection").style.display = "block";
  document.getElementById("newChatSection").style.display = "none";

  fetchAllMessages();
}

// 🔁 تفعيل/تعطيل الزر تلقائيًا أثناء الكتابة
messageInput.addEventListener("input", () => {
  const isEmpty = messageInput.value.trim() === "";
  const isLoading = sendBtn.querySelector(".loading-icon") !== null;
  sendBtn.disabled = isEmpty || isLoading;
});

function startNewChat() {
  // إغلاق المودال بالطريقة اليدوية
  const modalEl = document.getElementById("newChatModal");

  // إزالة show و style
  modalEl.classList.remove("show");
  modalEl.setAttribute("aria-hidden", "true");
  modalEl.removeAttribute("aria-modal");
  modalEl.style.display = "none";

  // حذف الـ backdrop
  document.querySelectorAll(".modal-backdrop").forEach(el => el.remove());

  // استرجاع body لطبيعته
  document.body.classList.remove("modal-open");
  document.body.style.paddingRight = '';
  document.body.style.overflow = '';

  // إفراغ الرسائل وبداية محادثة جديدة
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

  for (const msg of messages.reverse()) {  // الترتيب من الأقدم للأحدث
    const role = msg.role;
    let contentHtml = "";

    msg.content.forEach(part => {
      if (part.type === 'text') contentHtml += marked.parse(part.text.value);
      if (part.type === 'image_file') {
        const fileId = part.image_file.file_id;
        const imageUrl = `https://api.openai.com/v1/files/${fileId}/content`;
        contentHtml += `<img src="${imageUrl}" class="img-fluid rounded my-2" style="max-height:300px" />`;
      }
    });

    appendMessage(role, contentHtml);
  }
}
