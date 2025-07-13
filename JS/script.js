    let apiKey = "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";
    let assistantId = "asst_2bP9JIU6aYlumYAvb9VMf3f0";
    let threadId = localStorage.getItem("savedThreadId") || null;

    function appendMessage(role, htmlContent, isTemporary = false) {
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
      const messageText = document.getElementById("messageInput").value.trim();
      const imageFile = document.getElementById("imageInput").files[0];
      const content = [];

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

      document.getElementById("messageInput").value = "";
      document.getElementById("imageInput").value = "";

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

      fetchLastMessage();
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
      document.getElementById("newChatSection").style.display = "none";
    }

    if (threadId) {
      document.getElementById("inputSection").style.display = "block";
      document.getElementById("newChatSection").style.display = "none";
    }


    //-------------------------------------
    if (contentHtml.includes("<table")) {
  contentHtml = `<div class="table-wrapper">${contentHtml}</div>`;
}
