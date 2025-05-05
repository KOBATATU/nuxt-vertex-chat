<template>
  <div class="flex flex-col h-screen bg-gray-50">
    <header
      class="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 shadow-md sticky top-0 z-10"
    >
      <h1 class="text-xl font-semibold text-center">Nuxt3 Gemini Chat</h1>
    </header>

    <div
      ref="chatContainer"
      class="flex-1 overflow-y-auto p-4 md:p-6 space-y-4"
    >
      <div
        v-for="(message, index) in messages"
        :key="index"
        :class="[
          'flex',
          message.role === 'user' ? 'justify-end' : 'justify-start',
        ]"
      >
        <div
          :class="[
            'max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl rounded-lg px-4 py-2 shadow-md break-words',
            message.role === 'user'
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-800 border border-gray-200',
          ]"
        >
          <p class="whitespace-pre-wrap">{{ message.content }}</p>
        </div>
      </div>

      <div v-if="isLoading" class="flex justify-start">
        <div
          class="bg-white text-gray-500 rounded-lg px-4 py-2 shadow-md border border-gray-200 animate-pulse"
        >
          <span
            class="inline-block w-2 h-2 bg-gray-400 rounded-full mx-1 animate-bounce delay-0"
          ></span>
          <span
            class="inline-block w-2 h-2 bg-gray-400 rounded-full mx-1 animate-bounce delay-150"
          ></span>
          <span
            class="inline-block w-2 h-2 bg-gray-400 rounded-full mx-1 animate-bounce delay-300"
          ></span>
        </div>
      </div>
    </div>

    <div class="p-4 bg-gray-100 border-t border-gray-200 sticky bottom-0 z-10">
      <form @submit.prevent="sendMessage" class="flex items-center space-x-2">
        <textarea
          v-model="prompt"
          placeholder="メッセージを入力してください..."
          class="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none overflow-hidden bg-white shadow-sm max-h-56 overflow-y-auto"
          rows="4"
          :disabled="isLoading"
        ></textarea>
        <button
          type="submit"
          class="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-5 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 ease-in-out shadow-sm"
          :disabled="isLoading || !prompt.trim()"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="w-5 h-5"
          >
            <path
              d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z"
            />
          </svg>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Message {
  role: "user" | "model";
  content: string;
}

const prompt = ref("");
const messages = ref<Message[]>([]);
const isLoading = ref(false);
const chatContainer = ref<HTMLElement | null>(null);

// --- メッセージ送信処理 ---
const sendMessage = async () => {
  const messageContent = prompt.value.trim();
  if (!messageContent || isLoading.value) return;

  messages.value.push({ role: "user", content: messageContent });
  prompt.value = "";
  isLoading.value = true;
  messages.value.push({ role: "model", content: "" });
  scrollToBottom();

  try {
    const response = await fetch("/api/gemini/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ message: messageContent }),
    });

    if (!response.body) {
      throw new Error("Response body is missing.");
    }

    const stream = response.body;
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      /**
       * サーバーが data: メッセージ前半\n\ndata: メッセージ後半\n\n を送ったとしても、クライアントは以下のように2つのチャンクで受け取る可能性
       * 1回目の read(): value = ( data: メッセージ前半\n\ndata: メッセ のバイト列)
       * 2回目の read(): value = ( ージ後半\n\n のバイト列)
       * という感じでのことを考慮してlastChunkを利用する
       */
      buffer += decoder.decode(value);
      const lines = buffer.split("\n\n");
      const lastChunk = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.text) {
              messages.value[messages.value.length - 1].content += data.text;
              scrollToBottom();
            }
          } catch (e) {
            console.error("Failed to parse SSE data:", line, e);
          }
        }
      }

      if (done) {
        console.log("Stream finished.");
        break;
      }
      buffer = lastChunk;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } catch (error: any) {
    console.error("Error sending message or processing stream:", error);
  } finally {
    isLoading.value = false;
  }
};

// --- 自動スクロール ---
const scrollToBottom = () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
};
</script>

<style>
/* スクロールバーのスタイル（任意） */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb {
  background: #bdbdbd;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #888;
}

/* Textareaがフォーカスされてない時もスクロールバーを隠す（任意） */
textarea {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}
textarea::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

/* バウンスアニメーション */
@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}
.animate-bounce {
  animation: bounce 1s infinite;
}
.delay-150 {
  animation-delay: 0.15s;
}
.delay-300 {
  animation-delay: 0.3s;
}
</style>
