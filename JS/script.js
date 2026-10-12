let apiKey = getParam("key")
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
const clearFile = document.getElementById('clearFile');
const imageLabel = document.querySelector('label[for="imageInput"]');
const fileLabel = document.querySelector('label[for="fileInput"]');

function showFileName(name) {
  fileName.textContent = name;
  clearFile.style.display = "inline";
}

function clearSelectedFile() {
  fileName.textContent = "";
  clearFile.style.display = "none";
  imageInput.value = "";
  fileInput.value = "";
  imageInput.disabled = false;
  fileInput.disabled = false;
  imageLabel.classList.remove('disabled-btn');
  fileLabel.classList.remove('disabled-btn');
}

clearFile.addEventListener('click', clearSelectedFile);

imageInput.addEventListener('change', () => {
  if (imageInput.files && imageInput.files.length) {
    showFileName(imageInput.files[0].name);
    fileInput.disabled = true;
    fileLabel.classList.add('disabled-btn'); // disable file button
    imageLabel.classList.remove('disabled-btn');
  }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files.length) {
    showFileName(fileInput.files[0].name);
    imageInput.disabled = true;
    imageLabel.classList.add('disabled-btn'); // disable image button
    fileLabel.classList.remove('disabled-btn');
  }
});



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

const T = {
  ar: {
    send: "إرسال",
    processing: "⏳ جاري المعالجة...",
    newChat: "🆕 محادثة جديدة",
    confirmNewChat: "بدء محادثة جديدة",
    confirmMessage: "هل أنت متأكد أنك تريد بدء محادثة جديدة؟ سيتم مسح المحادثة الحالية.",
    yes: "نعم",
    no: "لا",
    placeholder: "اكتب رسالتك...",
    attachFile: "إرفاق ملف",
    uploadImage: "رفع صورة",
    assistantName: "(المحترف) ChatGPT 🤖",
    fileUploaded: "تم رفع ملف",
    analyzeFilePrompt: "ما هي التقارير والرسومات البيانيه التى يمكنك استخراجها من الملف {file} بشكل تحليلي مفصل بدون أسماء الحقول"
  },

  en: {
    send: "Send",
    processing: "⏳ Processing...",
    newChat: "🆕 New Chat",
    confirmNewChat: "Start New Chat",
    confirmMessage: "Are you sure you want to start a new chat? The current conversation will be cleared.",
    yes: "Yes",
    no: "No",
    placeholder: "Type your message...",
    attachFile: "Attach File",
    uploadImage: "Upload Image",
    assistantName: "ChatGPT Pro 🤖",
    fileUploaded: "File uploaded",
    analyzeFilePrompt: "What reports and charts can you generate from the file {file}? Provide a detailed analytical breakdown without mentioning field names."
  }
};

const txt = lang == 2 ? T.en : T.ar;

function applyLanguage() {

  document.documentElement.lang = lang == 2 ? "en" : "ar";
  document.documentElement.dir = lang == 2 ? "ltr" : "rtl";

  document.title = txt.assistantName;

  document.getElementById("sendBtn").innerText = txt.send;

  document.getElementById("messageInput").placeholder = txt.placeholder;

  document.getElementById("newChatSection").querySelector("button").innerText = txt.newChat;

  document.getElementById("newChatInputSection").innerText = txt.newChat;

  document.getElementById("newChatModalLabel").innerText = txt.confirmNewChat;

  document.querySelector("#newChatModal .modal-body").innerText = txt.confirmMessage;

  document.querySelector('[data-bs-dismiss="modal"]').innerText = txt.no;

  document.querySelector('#newChatModal .btn-secondary.fs-6').innerText = txt.yes;

  document.querySelector(".chat-header div").innerText = txt.assistantName;

  const imageBtn = document.querySelector('label[for="imageInput"]');
  imageBtn.title = txt.uploadImage;
  imageBtn.setAttribute("aria-label", txt.uploadImage);

  const fileBtn = document.querySelector('label[for="fileInput"]');
  fileBtn.title = txt.attachFile;
  fileBtn.setAttribute("aria-label", txt.attachFile);
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

    contentHtml += `<div class="file-attachment my-2 p-2 border rounded bg-light text-dark">
                      📄 ${otherFile.name}
                    </div>`;
  }

  // نص الرسالة
  if (messageText !== "") {
    content.push({ type: "text", text: messageText });
    contentHtml += marked.parse(messageText);
  }

  if (content.length === 0 && attachments.length === 0) {
    sendBtn.innerText = txt.send;
    sendBtn.disabled = messageInput.value.trim() === "";
    return;
  }

  appendMessage("user", contentHtml);
  appendMessage("assistant", txt.processing, true);

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

  sendBtn.innerText = txt.send;
  sendBtn.disabled = messageInput.value.trim() === "";
  fileName.textContent = ""
  fileName.textContent = "";
  clearFile.style.display = "none";
  imageInput.disabled = false;
  fileInput.disabled = false;
  imageLabel.classList.remove('disabled-btn');
  fileLabel.classList.remove('disabled-btn');
}
// async function fetchLastMessage() {
//   if (!threadId) return;

//   const res = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages?order=desc&limit=1`, {
//     headers: {
//       "Authorization": `Bearer ${apiKey}`,
//       "Content-Type": "application/json",
//       "OpenAI-Beta": "assistants=v2"
//     }
//   });

//   const data = await res.json();
//   const messages = data.data;
//   if (messages.length === 0) return;

//   const msg = messages[0];
//   const role = msg.role;
//   let contentHtml = "";

//   for (const part of msg.content) {
//     if (part.type === 'text') {
//       if (part.text.annotations && part.text.annotations.length > 0) {
//         part.text.annotations.forEach(ann => {
//           if (ann.type === "file_path" && ann.file_path?.file_id) {
//             const fileId = ann.file_path.file_id;
//             const fileName = ann.text.split("/").pop() || "downloaded_file";

//             const jsLink = `<a href="javascript:downloadFromOpenAI('${fileId}', '${fileName}')">${fileName}</a>`;

//             part.text.value = part.text.value.replace(ann.text, jsLink);
//           }
//         });
//       }
//       contentHtml += marked.parse(part.text.value);
//     }
//     if (part.type === 'image_file') {
//       const base64Image = await getImageBase64(part.image_file.file_id);
//       contentHtml += `<img src="${base64Image}" class="img-fluid rounded my-2" style="max-height:300px" />`;
//     }
//   }

//   // إزالة رسالة "جاري المعالجة..." لو موجودة
//   const loadingMsg = document.getElementById("loadingMessage");
//   if (loadingMsg) loadingMsg.parentElement.remove();

//   appendMessage(role, contentHtml);
// }



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
      if (msg.attachments && msg.attachments.length > 0) {
        for (const attachment of msg.attachments) {
          if (attachment.file_id) {
            const fileId = attachment.file_id;

            // Get the file metadata from OpenAI to get the original file name
            const fileMetaRes = await fetch(`https://api.openai.com/v1/files/${fileId}`, {
              headers: { "Authorization": `Bearer ${apiKey}` }
            });
            const fileMeta = await fileMetaRes.json();
            const fileName = fileMeta.filename || "downloaded_file";

            contentHtml += `
              <div class="file-attachment my-2 p-2 border rounded bg-light text-dark">
                📄 ${fileName}
              </div>
            `;
          }
        }
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

async function handleUploadedFile(fileId) {
  console.log("File uploaded with ID:", fileId);
  const name = await getFilename(fileId);
  // عرض رسالة المستخدم التي أرسلها مع الملف (تستطيع تعديل النص لو أردت)
  appendMessage("user", `<div>${txt.fileUploaded}: <strong>${name}</strong></div>`);
  appendMessage("assistant", txt.processing, true);

  // إرسال الرسالة التي تحتوي الملف للتحليل
  const msgResp = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "OpenAI-Beta": "assistants=v2",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      role: "user",
      content: [
        {
          type: "text",
          text: txt.analyzeFilePrompt.replace("{file}", name)
        }
      ],
      attachments: [
        {
          file_id: fileId,
          tools: [{ type: "code_interpreter" }]
        }
      ]
    })
  });

  const msgData = await msgResp.json();
  console.log("Message response:", msgData);

  // بدء الـ run للتحليل
  const runResp = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "OpenAI-Beta": "assistants=v2",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      assistant_id: assistantId
    })
  });

  const runData = await runResp.json();

  // متابعة حالة الـ run وعند اكتماله يتم جلب آخر رسالة وعرضها
  pollRunStatus(threadId, runData.id);
}


// دالة لمتابعة حالة الـ run

function displayMessage(sender, message) {
  const chatMessages = document.getElementById("chatMessages");
  const messageElement = document.createElement("div");
  messageElement.classList.add("message", sender);

  const icon = document.createElement("div");
  icon.classList.add("icon");
  icon.textContent = sender === "user" ? "🧑" : "🤖";

  const text = document.createElement("div");
  text.classList.add("text");
  text.innerHTML = message;

  messageElement.appendChild(icon);
  messageElement.appendChild(text);
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
async function loadMessages(threadId) {
  const msgListResp = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "OpenAI-Beta": "assistants=v2"
    }
  });
  const messagesData = await msgListResp.json();
  const messages = messagesData.data;

  messages.forEach(msg => {
    let role = msg.role;
    let contentHtml = ""; // لازم تهيئه هنا لكل رسالة قبل ملئه

    msg.content.forEach(part => {
      if (part.type === 'text') {
        contentHtml += part.text.value; // مثال، أو استخدم marked.parse(part.text.value) لو تستخدم Markdown
      }
      // هنا تكمل معالجة أنواع المحتوى الثانية (image_file، إلخ) حسب الحاجة
    });
    appendMessage("user", contentHtml);
    appendMessage("assistant", txt.processing, true);
    appendMessage(role, contentHtml);
  });
}

// تعديل pollRunStatus لعرض الرسائل فور انتهاء الـ run
async function pollRunStatus(threadId, runId) {
  let runStatus = null;

  do {
    const runResp = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "OpenAI-Beta": "assistants=v2"
      }
    });

    const runData = await runResp.json();
    runStatus = runData.status;
    console.log("Run status:", runStatus);

    if (runStatus === "in_progress" || runStatus === "queued") {
      await new Promise(r => setTimeout(r, 1500)); // تأخير
    }

  } while (runStatus === "in_progress" || runStatus === "queued");

  if (runStatus === "completed") {
    console.log("Run completed. Fetching last message...");
    // إزالة رسالة "جاري المعالجة..."
    const loadingMsg = document.getElementById("loadingMessage");
    if (loadingMsg) loadingMsg.parentElement.remove();

    // عرض آخر رسالة من المساعد فقط (الرد الجديد)
    await fetchLastMessage();
  }
}
async function getFilename(fileId) {
  try {
    const res = await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP error! Status: ${res.status}`);
    }

    const data = await res.json();
    return data.filename;
  } catch (err) {
    console.error("Error fetching filename:", err);
    return null;
  }
}

applyLanguage();
// Example:
//getFilename("file-KjGEGqNnnbmcTSysM6ghuH").then(name => console.log(name));