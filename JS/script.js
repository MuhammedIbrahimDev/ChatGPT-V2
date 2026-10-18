"use strict";

/* =========================================================
   1. Configuration
========================================================= */

const API_BASE = "https://api.openai.com/v1";

const apiKey = getParam("key") ;
const lang = getParam("lang") || "1";

const MODEL = getParam("model") || "gpt-4.1-mini";

let conversationId = localStorage.getItem("savedConversationId") || null;

let isProcessing = false;
let pendingExternalFile = null;

/*
   Assistants API has been retired.
   Remove the obsolete saved thread identifier.
*/

localStorage.removeItem("savedThreadId");

/* =========================================================
   2. DOM Elements
========================================================= */

const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const imageInput = document.getElementById("imageInput");
const fileInput = document.getElementById("fileInput");

const fileName = document.getElementById("fileName");
const clearFile = document.getElementById("clearFile");

const imageLabel = document.querySelector('label[for="imageInput"]');

const fileLabel = document.querySelector('label[for="fileInput"]');

const chatBox = document.getElementById("chatBox");
const inputSection = document.getElementById("inputSection");

const newChatSection = document.getElementById("newChatSection");

const newChatInputSection = document.getElementById("newChatInputSection");

/* =========================================================
   3. Language
========================================================= */

const T = {
  ar: {
    send: "إرسال",
    processing: "⏳ جاري المعالجة...",
    newChat: "🆕 محادثة جديدة",

    confirmNewChat: "بدء محادثة جديدة",

    confirmMessage:
      "هل أنت متأكد أنك تريد بدء محادثة جديدة؟ سيتم مسح المحادثة الحالية من الشاشة.",

    yes: "نعم",
    no: "لا",

    placeholder: "اكتب رسالتك...",

    attachFile: "إرفاق ملف",
    uploadImage: "رفع صورة",

    assistantName: "(المحترف) ChatGPT 🤖",

    fileUploaded: "تم رفع ملف",

    analyzeFilePrompt:
      "حلل الملف المرفق {file} تحليلاً مفصلاً. اقترح التقارير والرسومات البيانية المناسبة، واستخرج أهم النتائج والأنماط والاستنتاجات. أنشئ الرسومات والملفات الناتجة عند الحاجة. لا تذكر أسماء الحقول التقنية إلا إذا كانت ضرورية.",

    missingKey:
      "لم يتم العثور على مفتاح API. أضف المفتاح إلى عنوان الصفحة باستخدام key.",

    connectionError: "حدث خطأ أثناء الاتصال بالخدمة.",

    emptyResponse: "لم يرجع النموذج أي نص في هذه الاستجابة.",

    uploadError: "تعذر رفع الملف.",

    downloadError: "تعذر تنزيل الملف.",

    unsupported: "نوع الملف غير مدعوم لهذه العملية.",

    newConversationError: "تعذر إنشاء محادثة جديدة.",

    retry: "حاول مرة أخرى.",

    fileLabel: "الملف المرفق",

    imageLabel: "الصورة المرفقة",
  },

  en: {
    send: "Send",
    processing: "⏳ Processing...",
    newChat: "🆕 New Chat",

    confirmNewChat: "Start New Chat",

    confirmMessage:
      "Are you sure you want to start a new chat? The current conversation will be cleared from the screen.",

    yes: "Yes",
    no: "No",

    placeholder: "Type your message...",

    attachFile: "Attach File",
    uploadImage: "Upload Image",

    assistantName: "ChatGPT Pro 🤖",

    fileUploaded: "File uploaded",

    analyzeFilePrompt:
      "Analyze the attached file {file} in detail. Suggest suitable reports and charts, identify important findings, patterns, and conclusions, and generate charts or downloadable files when appropriate. Avoid mentioning technical field names unless necessary.",

    missingKey: "No API key was found. Add the key to the page URL using key.",

    connectionError: "An error occurred while connecting to the service.",

    emptyResponse: "The model returned no text in this response.",

    uploadError: "The file could not be uploaded.",

    downloadError: "The file could not be downloaded.",

    unsupported: "The file type is not supported for this operation.",

    newConversationError: "Could not create a new conversation.",

    retry: "Please try again.",

    fileLabel: "Attached file",

    imageLabel: "Attached image",
  },
};

const txt = lang === "2" ? T.en : T.ar;

/* =========================================================
   4. Instructions
========================================================= */

/*
   The old Assistant's private instructions are not available
   in the supplied JavaScript.
   These are replacement instructions. Edit them as needed.
*/

const MODEL_INSTRUCTIONS = `
You are a helpful AI assistant.

Answer in the same language as the user unless the user
requests another language.

Support Arabic and English.

When a user uploads a file:
- Read and analyze the available file contents.
- Use Code Interpreter when calculations, data analysis,
  charts, or file generation are appropriate.
- Explain findings clearly.
- Generate downloadable files when requested or useful.
- Do not invent results that are not supported by the data.

When a user uploads an image:
- Examine the image and answer questions about its contents.

Format responses using Markdown when useful.
`;

/* =========================================================
   5. General Helpers
========================================================= */

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, function (char) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return map[char];
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(data) {
  if (data?.error?.message) {
    return data.error.message;
  }

  if (data?.message) {
    return data.message;
  }

  return txt.connectionError;
}

function renderMarkdown(text) {
  if (typeof marked !== "undefined") {
    return marked.parse(String(text ?? ""));
  }

  return escapeHtml(text).replace(/\n/g, "<br>");
}

/* =========================================================
   6. API Request Helper
========================================================= */

async function apiRequest(
  endpoint,

  options = {},
) {
  if (!apiKey) {
    throw new Error(txt.missingKey);
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,

    ...(options.headers || {}),
  };

  const response = await fetch(
    `${API_BASE}${endpoint}`,

    {
      ...options,

      headers,
    },
  );

  const contentType = response.headers.get("content-type") || "";

  let data;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.blob();
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(data));
  }

  return data;
}

/* =========================================================
   7. Upload Files
========================================================= */

/*
   Responses API file inputs use the user_data purpose.

   The uploaded file ID can be referenced in an input_file
   or input_image content item.
*/

async function uploadFile(file) {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("purpose", "user_data");

  return await apiRequest("/files", {
    method: "POST",

    body: formData,
  });
}

/* =========================================================
   8. File Name UI
========================================================= */

function showFileName(name) {
  fileName.textContent = name;
  clearFile.style.display = "inline";
}

function clearSelectedFile() {
  imageInput.value = "";
  fileInput.value = "";

  imageInput.disabled = false;
  fileInput.disabled = false;

  imageLabel.classList.remove("disabled-btn");
  fileLabel.classList.remove("disabled-btn");

  fileName.textContent = "";
  clearFile.style.display = "none";
}

clearFile.addEventListener("click", clearSelectedFile);

imageInput.addEventListener("change", function () {
  if (!imageInput.files || !imageInput.files.length) {
    return;
  }

  showFileName(imageInput.files[0].name);

  fileInput.disabled = true;
  fileLabel.classList.add("disabled-btn");

  imageLabel.classList.remove("disabled-btn");
});

fileInput.addEventListener("change", function () {
  if (!fileInput.files || !fileInput.files.length) {
    return;
  }

  showFileName(fileInput.files[0].name);

  imageInput.disabled = true;
  imageLabel.classList.add("disabled-btn");

  fileLabel.classList.remove("disabled-btn");
});

/* =========================================================
   9. Message UI
========================================================= */

function appendMessage(
  role,
  htmlContent,

  isTemporary = false,
) {
  if (htmlContent.includes("<table")) {
    htmlContent = `<div class="table-wrapper">${htmlContent}</div>`;
  }

  const bubble = document.createElement("div");

  bubble.className = `bubble ${role === "user" ? "user-msg" : "assistant-msg"}`;

  bubble.innerHTML = htmlContent;

  if (isTemporary) {
    bubble.id = "loadingMessage";
  }

  const wrapper = document.createElement("div");

  wrapper.className = "d-flex flex-column";

  wrapper.appendChild(bubble);

  chatBox.appendChild(wrapper);

  chatBox.scrollTop = chatBox.scrollHeight;

  return bubble;
}

function removeLoadingMessage() {
  const loadingMessage = document.getElementById("loadingMessage");

  if (loadingMessage) {
    loadingMessage.parentElement.remove();
  }
}

function showError(message) {
  removeLoadingMessage();

  appendMessage(
    "assistant",

    `<div class="text-danger">${escapeHtml(message)}</div>`,
  );
}

function imageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);

    reader.onerror = () => reject(reader.error);

    reader.readAsDataURL(file);
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);

    reader.readAsDataURL(file);
  });
}

/* =========================================================
   10. Image Preview
========================================================= */

function previewImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function () {
      const image = document.createElement("img");

      image.src = reader.result;

      image.className = "img-fluid rounded my-2";

      image.style.maxHeight = "300px";

      image.style.display = "block";

      resolve(image);
    };

    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}

/* =========================================================
   11. Create Conversation
========================================================= */

async function createNewThread() {
  if (isProcessing) {
    return;
  }

  try {
    const data = await apiRequest(
      "/conversations",

      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({}),
      },
    );

    conversationId = data.id;

    localStorage.setItem(
      "savedConversationId",

      conversationId,
    );

    chatBox.innerHTML = "";

    inputSection.style.display = "block";

    newChatInputSection.style.display = "block";

    newChatSection.style.display = "none";

    messageInput.focus();

    updateSendButton();
  } catch (error) {
    console.error(
      "Create conversation error:",

      error,
    );
    showError(`${txt.newConversationError} ${error.message}`);
  }
}

/* =========================================================
   12. Start New Conversation
========================================================= */

function startNewChat() {
  const modalEl = document.getElementById("newChatModal");

  if (modalEl) {
    modalEl.classList.remove("show");

    modalEl.setAttribute(
      "aria-hidden",

      "true",
    );

    modalEl.removeAttribute("aria-modal");

    modalEl.style.display = "none";
  }

  document
    .querySelectorAll(".modal-backdrop")

    .forEach((element) => element.remove());

  document.body.classList.remove("modal-open");

  document.body.style.paddingRight = "";

  document.body.style.overflow = "";

  if (isProcessing) {
    return;
  }

  chatBox.innerHTML = "";

  clearSelectedFile();

  messageInput.value = "";

  /*
     The old conversation remains on OpenAI's servers.
     This starts a new conversation and replaces the
     locally saved conversation ID.
  */

  conversationId = null;

  localStorage.removeItem("savedConversationId");

  createNewThread();
}

/* =========================================================
   13. Display Stored Images
========================================================= */

async function getFileContentUrl(fileId) {
  const response = await apiRequest(
    `/files/${encodeURIComponent(fileId)}/content`,
  );

  const objectUrl = URL.createObjectURL(response);

  return objectUrl;
}

async function appendStoredImage(fileId) {
  try {
    const imageUrl = await getFileContentUrl(fileId);

    const image = document.createElement("img");

    image.src = imageUrl;

    image.className = "img-fluid rounded my-2";

    image.style.maxHeight = "300px";

    image.style.display = "block";

    const wrapper = document.createElement("div");

    wrapper.className = "bubble user-msg";

    wrapper.appendChild(image);

    const outer = document.createElement("div");

    outer.className = "d-flex flex-column";

    outer.appendChild(wrapper);

    chatBox.appendChild(outer);

    chatBox.scrollTop = chatBox.scrollHeight;
  } catch (error) {
    console.error(
      "Display stored image error:",

      error,
    );

    appendMessage(
      "user",

      `<div>${escapeHtml(txt.imageLabel)}</div>`,
    );
  }
}

/* =========================================================
   14. Download Generated Files
========================================================= */

/*
   Files generated by Code Interpreter are container files.

   Their download endpoint is:
   /v1/containers/{container_id}/files/{file_id}/content

   Ordinary uploaded files use:
   /v1/files/{file_id}/content
*/

async function downloadFromOpenAI(
  fileId,
  fileName,

  containerId = null,
) {
  try {
    let blob;

    if (containerId) {
      blob = await apiRequest(
        `/containers/${encodeURIComponent(containerId)}` +
          `/files/${encodeURIComponent(fileId)}/content`,
      );
    } else {
      blob = await apiRequest(`/files/${encodeURIComponent(fileId)}/content`);
    }

    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");

    anchor.href = url;

    anchor.download = fileName || "downloaded_file";

    document.body.appendChild(anchor);

    anchor.click();

    anchor.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (error) {
    console.error(
      "Download error:",

      error,
    );
    showError(`${txt.downloadError} ${error.message}`);
  }
}

/* =========================================================
   15. Render Response Annotations
========================================================= */

function createDownloadLink(
  fileId,
  fileName,

  containerId,
) {
  const link = document.createElement("a");

  link.href = "#";

  link.textContent = fileName || "Download file";

  link.addEventListener("click", function (event) {
    event.preventDefault();

    downloadFromOpenAI(
      fileId,
      fileName,

      containerId,
    );
  });

  return link;
}

function renderOutputText(outputText) {
  let text = outputText.text || "";

  const annotations = outputText.annotations || [];

  const html = renderMarkdown(text);

  const container = document.createElement("div");

  container.innerHTML = html;

  /*
     Render file links separately from Markdown.
     The annotation index may vary by output type,
     so links are displayed explicitly here.
  */

  for (const annotation of annotations) {
    if (
      annotation.type === "container_file_citation" ||
      annotation.type === "file_path"
    ) {
      const fileId = annotation.file_id;

      const containerId = annotation.container_id || null;

      const fileName = annotation.filename || fileId || "downloaded_file";

      if (!fileId) {
        continue;
      }

      const link = createDownloadLink(
        fileId,

        fileName,

        containerId,
      );

      const wrapper = document.createElement("div");

      wrapper.className = "my-2 p-2 border rounded";

      wrapper.appendChild(link);

      container.appendChild(wrapper);
    }
  }

  return container;
}

/* =========================================================
   16. Render API Output
========================================================= */

async function renderResponseOutput(responseData) {
  const output = responseData.output || [];

  let hasVisibleText = false;

  for (const item of output) {
    /*
       Assistant message
    */

    if (item.type === "message" && item.role === "assistant") {
      for (const part of item.content || []) {
        if (part.type === "output_text") {
          const content = renderOutputText(part);

          appendMessage(
            "assistant",

            content.innerHTML,
          );

          hasVisibleText = true;
        }

        if (part.type === "refusal") {
          appendMessage(
            "assistant",

            renderMarkdown(part.refusal),
          );

          hasVisibleText = true;
        }
      }
    }

    /*
       Code Interpreter output images.

       The API may return image URLs as part of
       included code_interpreter_call.outputs.
    */

    if (item.type === "code_interpreter_call") {
      for (const outputItem of item.outputs || []) {
        if (outputItem.type === "image" && outputItem.url) {
          const image = document.createElement("img");

          image.src = outputItem.url;

          image.className = "img-fluid rounded my-2";

          image.style.maxHeight = "400px";

          image.style.display = "block";

          const wrapper = document.createElement("div");

          wrapper.className = "bubble assistant-msg";

          wrapper.appendChild(image);

          const outer = document.createElement("div");

          outer.className = "d-flex flex-column";

          outer.appendChild(wrapper);

          chatBox.appendChild(outer);

          hasVisibleText = true;
        }
      }
    }
  }

  if (!hasVisibleText) {
    const text = responseData.output_text || txt.emptyResponse;

    appendMessage(
      "assistant",

      renderMarkdown(text),
    );
  }
}

/* =========================================================
   17. Send Message
========================================================= */

async function sendMessage() {
  if (isProcessing) {
    return;
  }

  const messageText = messageInput.value.trim();

  const imageFile = imageInput.files?.[0] || null;

  const otherFile = fileInput.files?.[0] || null;

  if (!messageText.trim() && !imageFile && !otherFile && !pendingExternalFile) {
    return;
  }

  if (!apiKey) {
    showError(txt.missingKey);
    return;
  }

  isProcessing = true;

  updateSendButton();

  let userHtml = "";

  let uploadedImage = null;

  let uploadedFile = null;

  try {
    /*
       1. Ensure a conversation exists.
    */

    if (!conversationId) {
      const conversation = await apiRequest(
        "/conversations",

        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({}),
        },
      );

      conversationId = conversation.id;

      localStorage.setItem(
        "savedConversationId",

        conversationId,
      );

      inputSection.style.display = "block";

      newChatInputSection.style.display = "block";

      newChatSection.style.display = "none";
    }

    /*
       2. Prepare input content.
    */

    const content = [];

    if (messageText) {
      content.push({
        type: "input_text",

        text: messageText,
      });

      userHtml += renderMarkdown(messageText);
    }

    /*
       3. Upload image and add input_image.
    */

    if (imageFile) {
      const imageDataUrl = await imageToDataUrl(imageFile);

      content.push({
        type: "input_image",
        image_url: imageDataUrl,

        detail: "auto",
      });

      const preview = await previewImage(imageFile);

      const temporaryContainer = document.createElement("div");

      temporaryContainer.appendChild(preview);

      userHtml += temporaryContainer.innerHTML;
    }

    /*
       4. Attach either a file uploaded from VB6 or a file selected in the browser.
    */

    if (pendingExternalFile) {
      uploadedFile = {
        id: pendingExternalFile.id,
        name: pendingExternalFile.name,
      };

      content.push({
        type: "input_text",
        text: `[ATTACHED_FILE_NAME]${uploadedFile.name}`,
      });

      content.push({
        type: "input_file",
        file_id: uploadedFile.id,
      });

      userHtml += `
        <div class="file-attachment my-2 p-2 border rounded bg-light text-dark">
            📄 ${escapeHtml(uploadedFile.name)}
        </div>
    `;
    } else if (otherFile) {
      uploadedFile = await uploadFile(otherFile);

      const fileDataUrl = await fileToDataUrl(otherFile);

      content.push({
        type: "input_file",
        filename: otherFile.name,
        file_data: fileDataUrl,
      });

      userHtml += `
        <div class="file-attachment my-2 p-2 border rounded bg-light text-dark">
            📄 ${escapeHtml(otherFile.name)}
        </div>
    `;
    }
    /*
       5. Show the user message and loading indicator.
    */

    appendMessage(
      "user",

      userHtml,
    );

    appendMessage(
      "assistant",
      escapeHtml(txt.processing),

      true,
    );

    messageInput.value = "";

    clearSelectedFile();

    /*
       6. Configure Code Interpreter when a file is attached.

       The auto container makes uploaded file IDs
       available to the analysis tool.
    */

    const tools = [];

    if (uploadedFile) {
      tools.push({
        type: "code_interpreter",
        container: {
          type: "auto",
          file_ids: [uploadedFile.id],
        },
      });
    }

    /*
       7. Create a response.

       Conversations API stores the input and output
       items for this conversation automatically.
    */

    const requestBody = {
      model: MODEL,

      conversation: conversationId,

      instructions: MODEL_INSTRUCTIONS,

      input: [
        {
          role: "user",

          content: content,
        },
      ],

      store: true,

      include: [
        "code_interpreter_call.outputs",

        "message.input_image.image_url",
      ],
    };

    if (tools.length > 0) {
      requestBody.tools = tools;
    }

    const responseData = await apiRequest("/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    /*
       8. Remove loading indicator.
    */

    removeLoadingMessage();

    /*
       9. Handle unsuccessful or incomplete responses.
    */

    if (responseData.status && responseData.status !== "completed") {
      const reason =
        responseData.incomplete_details?.reason || responseData.status;

      throw new Error(`Response status: ${reason}`);
    }

    /*
       10. Render assistant output.
    */

    await renderResponseOutput(responseData);

    // The externally uploaded file has now been sent successfully.
    pendingExternalFile = null;
  } catch (error) {
    console.error(
      "Send message error:",

      error,
    );

    removeLoadingMessage();

    showError(`${txt.connectionError} ${error.message}`);
  } finally {
    isProcessing = false;

    updateSendButton();
  }
}

/* =========================================================
   18. Load Conversation History
========================================================= */

async function fetchAllMessages() {
  if (!conversationId) {
    return;
  }

  try {
    chatBox.innerHTML = "";

    /*
       List conversation items in chronological order.
       Request additional pages if the conversation
       contains more than 100 items.
    */

    let allItems = [];

    let after = null;

    let hasMore = true;

    while (hasMore) {
      let endpoint =
        `/conversations/${encodeURIComponent(conversationId)}` +
        `/items?limit=100&order=asc` +
        `&include%5B%5D=message.input_image.image_url`;

      if (after) {
        endpoint += `&after=${encodeURIComponent(after)}`;
      }

      const page = await apiRequest(endpoint);

      console.log(
        "Conversation images:",
        page.data

          .flatMap((item) => item.content || [])

          .filter((part) => part.type === "input_image"),
      );
      const items = page.data || [];

      allItems.push(...items);

      hasMore = Boolean(page.has_more);

      after = page.last_id || null;

      if (!after || items.length === 0) {
        break;
      }
    }
    console.log("Conversation items:", allItems);

    /*
       Render user and assistant messages.
    */

    for (const item of allItems) {
      if (
        item.type !== "message" ||
        !["user", "assistant"].includes(item.role)
      ) {
        continue;
      }

      const role = item.role;

      let contentHtml = "";

      const hasStoredFileName = (item.content || []).some(
        (part) =>
          part.type === "input_text" &&
          (part.text || "").startsWith("[ATTACHED_FILE_NAME]"),
      );

      for (const part of item.content || []) {
        /*
           Text input/output
        */

        if (
          part.type === "input_text" ||
          part.type === "output_text" ||
          part.type === "text"
        ) {
          const text = part.text || "";

          if (role === "user" && text.startsWith("[ATTACHED_FILE_NAME]")) {
            const storedFileName = text.substring(
              "[ATTACHED_FILE_NAME]".length,
            );

            contentHtml += `
        <div class="file-attachment my-2 p-2 border rounded bg-light text-dark">
            📄 ${escapeHtml(storedFileName)}
        </div>
    `;
          } else {
            contentHtml += renderMarkdown(text);
          }

          /*
             Generated file annotations.
          */

          for (const annotation of part.annotations || []) {
            if (
              annotation.type === "container_file_citation" ||
              annotation.type === "file_path"
            ) {
              const fileId = annotation.file_id;

              const containerId = annotation.container_id || null;

              const fileName =
                annotation.filename || fileId || "downloaded_file";

              if (!fileId) {
                continue;
              }

              const link = createDownloadLink(
                fileId,

                fileName,

                containerId,
              );

              const wrapper = document.createElement("div");

              wrapper.className = "my-2 p-2 border rounded";

              wrapper.appendChild(link);

              contentHtml += wrapper.outerHTML;
            }
          }
        }

        /*
           Stored image inputs.
        */

        if (part.type === "input_image") {
          if (
            typeof part.image_url === "string" &&
            part.image_url.trim() !== ""
          ) {
            contentHtml += `
            <img
                src="${escapeHtml(part.image_url)}"
                alt="${escapeHtml(txt.imageLabel)}"
                class="img-fluid rounded my-2"
                style="max-height:300px;max-width:100%;display:block"
            />
        `;
          } else {
            console.warn(
              "Image URL was not returned by OpenAI:",

              part.file_id,
            );

            contentHtml += `
            <div class="text-muted my-2">
                ${escapeHtml(txt.imageLabel)}
                <br>
                <small>
                    تعذر استرجاع رابط الصورة من المحادثة.
                </small>
            </div>
        `;
          }
        }

        /*
          Stored file inputs.
        */

        if (part.type === "input_file" && !hasStoredFileName) {
          const storedFileName = part.filename || null;

          contentHtml += `
            <div class="file-attachment my-2 p-2 border rounded bg-light text-dark">
              📄 ${escapeHtml(storedFileName || txt.fileLabel)}
            </div>
          `;
        }
      }

      if (contentHtml.trim()) {
        appendMessage(
          role,

          contentHtml,
        );
      }
    }
  } catch (error) {
    console.error(
      "Load conversation history error:",

      error,
    );
    showError(`${txt.connectionError} ${error.message}`);
  }
}

/* =========================================================
   19. Send Button State
========================================================= */

function updateSendButton() {
  if (isProcessing) {
    sendBtn.disabled = true;

    sendBtn.innerHTML = `<span class="loading-icon"></span>`;

    return;
  }

  sendBtn.innerText = txt.send;

  const hasText = messageInput.value.trim() !== "";

  const hasImage = imageInput.files && imageInput.files.length > 0;

  const hasFile = fileInput.files && fileInput.files.length > 0;

  const hasExternalFile = Boolean(pendingExternalFile);

  sendBtn.disabled = !(hasText || hasImage || hasFile || hasExternalFile);
}

messageInput.addEventListener(
  "input",

  updateSendButton,
);

messageInput.addEventListener(
  "keydown",
  function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      if (!sendBtn.disabled) {
        sendMessage();
      }
    }
  },
);

/* =========================================================
   20. Apply Language
========================================================= */

function applyLanguage() {
  const isEnglish = lang === "2";

  document.documentElement.lang = isEnglish ? "en" : "ar";

  document.documentElement.dir = isEnglish ? "ltr" : "rtl";

  document.title = txt.assistantName;

  sendBtn.innerText = txt.send;

  messageInput.placeholder = txt.placeholder;

  newChatSection.querySelector("button").innerText = txt.newChat;

  newChatInputSection.innerText = txt.newChat;

  document.getElementById("newChatModalLabel").innerText = txt.confirmNewChat;

  document.querySelector("#newChatModal .modal-body").innerText =
    txt.confirmMessage;

  document.querySelector('[data-bs-dismiss="modal"]').innerText = txt.no;

  document.querySelector("#newChatModal .btn-secondary.fs-6").innerText =
    txt.yes;

  document.querySelector(".chat-header div").innerText = txt.assistantName;

  imageLabel.title = txt.uploadImage;

  imageLabel.setAttribute(
    "aria-label",

    txt.uploadImage,
  );

  fileLabel.title = txt.attachFile;

  fileLabel.setAttribute(
    "aria-label",
    txt.attachFile,
  );
}

/* =========================================================
   21. Initialize Application
========================================================= */

async function initializeApplication() {
  applyLanguage();

  updateSendButton();

  /*
     If an existing conversation ID is saved,
     restore its messages.
  */

  if (conversationId) {
    inputSection.style.display = "block";

    newChatInputSection.style.display = "block";

    newChatSection.style.display = "none";

    await fetchAllMessages();

    return;
  }

  /*
     No conversation exists yet.
     Show the New Chat button as in the original UI.
  */

  inputSection.style.display = "none";

  newChatInputSection.style.display = "none";

  newChatSection.style.display = "block";
}

function handleUploadedFile(fileId, uploadedName) {
  if (!fileId || typeof fileId !== "string") {
    console.error("handleUploadedFile: invalid file id");
    return;
  }

  pendingExternalFile = {
    id: fileId,
    name: uploadedName || "Excel exported from VB6.xlsx",
  };

  const input = document.getElementById("messageInput");

  if (input && !input.value.trim()) {
    input.value =
      lang === "1"
        ? "حلل ملف Excel المرفق تحليلاً مفصلاً، واستخرج أهم النتائج والإحصائيات والأنماط، واقترح جداول ورسومات مناسبة. لا تخترع بيانات غير موجودة في الملف."
        : "Analyze the attached Excel file in detail. Extract key findings, statistics, and patterns, and suggest suitable tables and charts. Do not invent data that is not present in the file.";
  }

  updateSendButton();
  sendMessage();
}

initializeApplication();