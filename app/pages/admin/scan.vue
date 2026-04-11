<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { showToast, showSuccessToast } from "vant";

const scanning = ref(false);
const lastResult = ref<{
  status: "success" | "used" | "expired" | "invalid";
  ticketCode: string;
  time: string;
} | null>(null);

const scanCount = ref(0);
const successCount = ref(0);

let videoElement: HTMLVideoElement | null = null;
let stream: MediaStream | null = null;

const getAuthHeaders = () => {
  const token = localStorage.getItem("adminToken");
  if (!token) {
    navigateTo("/admin");
    return {};
  }
  return { "x-admin-token": token };
};

const verifyTicket = async (code: string) => {
  try {
    const res = await $fetch<{ ok: boolean; status: string }>(
      "/api/admin/verify",
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: { ticketCode: code },
      }
    );

    scanCount.value++;
    const status = res.ok ? "success" : (res.status as "used" | "expired");

    lastResult.value = {
      status,
      ticketCode: code,
      time: new Date().toLocaleTimeString(),
    };

    if (res.ok) {
      successCount.value++;
      showSuccessToast("验票成功");
    } else {
      const messages: Record<string, string> = {
        used: "门票已使用",
        expired: "门票已过期",
      };
      showToast(messages[res.status] || "验票失败");
    }
  } catch (e: any) {
    scanCount.value++;
    lastResult.value = {
      status: "invalid",
      ticketCode: code,
      time: new Date().toLocaleTimeString(),
    };
    showToast("无效门票码");
  }
};

const startCamera = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    videoElement = document.querySelector("#scan-video");
    if (videoElement) {
      videoElement.srcObject = stream;
      await videoElement.play();
      scanning.value = true;
    }
  } catch (e) {
    showToast("无法访问摄像头");
  }
};

const stopCamera = () => {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  scanning.value = false;
};

const manualCode = ref("");
const handleManualInput = () => {
  if (!manualCode.value.trim()) {
    showToast("请输入门票码");
    return;
  }
  verifyTicket(manualCode.value.trim());
  manualCode.value = "";
};

const goBack = () => {
  stopCamera();
  navigateTo("/admin");
};

const getStatusInfo = (status: string) => {
  const info: Record<
    string,
    { text: string; color: string; bgColor: string }
  > = {
    success: {
      text: "验票成功",
      color: "#4caf50",
      bgColor: "rgba(76, 175, 80, 0.15)",
    },
    used: {
      text: "已使用",
      color: "#ff9800",
      bgColor: "rgba(255, 152, 0, 0.15)",
    },
    expired: {
      text: "已过期",
      color: "#f44336",
      bgColor: "rgba(244, 67, 54, 0.15)",
    },
    invalid: {
      text: "无效门票",
      color: "#9e9e9e",
      bgColor: "rgba(158, 158, 158, 0.15)",
    },
  };
  return info[status] || info.invalid;
};

onMounted(() => {
  const token = localStorage.getItem("adminToken");
  if (!token) {
    navigateTo("/admin");
  }
});

onUnmounted(() => {
  stopCamera();
});
</script>

<template>
  <div class="scan-page">
    <div class="scan-header">
      <div class="header-left" @click="goBack">
        <van-icon name="arrow-left" />
        <span>返回</span>
      </div>
      <div class="header-title">扫码验票</div>
      <div class="header-right">
        <span class="count">{{ successCount }}/{{ scanCount }}</span>
      </div>
    </div>

    <div class="camera-section">
      <video
        id="scan-video"
        class="camera-video"
        :class="{ active: scanning }"
        autoplay
        playsinline
        muted
      ></video>

      <div v-if="!scanning" class="camera-overlay" @click="startCamera">
        <div class="overlay-content">
          <van-icon name="scan" class="scan-icon" />
          <div class="scan-text">点击开始扫码</div>
        </div>
      </div>

      <div v-if="scanning" class="scan-frame">
        <div class="frame-corner top-left"></div>
        <div class="frame-corner top-right"></div>
        <div class="frame-corner bottom-left"></div>
        <div class="frame-corner bottom-right"></div>
        <div class="scan-line"></div>
      </div>

      <div v-if="scanning" class="stop-btn" @click="stopCamera">
        <van-icon name="cross" />
      </div>
    </div>

    <div v-if="lastResult" class="result-section">
      <div
        class="result-card"
        :style="{
          backgroundColor: getStatusInfo(lastResult.status).bgColor,
          borderLeftColor: getStatusInfo(lastResult.status).color,
        }"
      >
        <div
          class="result-status"
          :style="{ color: getStatusInfo(lastResult.status).color }"
        >
          {{ getStatusInfo(lastResult.status).text }}
        </div>
        <div class="result-code">{{ lastResult.ticketCode }}</div>
        <div class="result-time">{{ lastResult.time }}</div>
      </div>
    </div>

    <div class="input-section">
      <div class="input-label">手动输入门票码</div>
      <div class="input-row">
        <input
          v-model="manualCode"
          type="text"
          class="code-input"
          placeholder="输入门票码后按回车验证"
          @keyup.enter="handleManualInput"
        />
        <button class="verify-btn" @click="handleManualInput">验证</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.scan-page {
  min-height: 100vh;
  background: #000;
  display: flex;
  flex-direction: column;
}

.scan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;

  .header-left {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  .header-title {
    font-size: 17px;
    font-weight: 500;
  }

  .header-right {
    .count {
      font-size: 14px;
      color: #4caf50;
      font-weight: 500;
    }
  }
}

.camera-section {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.camera-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.3s;

  &.active {
    opacity: 1;
  }
}

.camera-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  .overlay-content {
    text-align: center;

    .scan-icon {
      font-size: 80px;
      color: #1976d2;
      margin-bottom: 16px;
    }

    .scan-text {
      font-size: 18px;
      color: #fff;
    }
  }
}

.scan-frame {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 70%;
  aspect-ratio: 1;

  .frame-corner {
    position: absolute;
    width: 24px;
    height: 24px;
    border-color: #fff;
    border-style: solid;
    border-width: 0;

    &.top-left {
      top: 0;
      left: 0;
      border-top-width: 3px;
      border-left-width: 3px;
    }

    &.top-right {
      top: 0;
      right: 0;
      border-top-width: 3px;
      border-right-width: 3px;
    }

    &.bottom-left {
      bottom: 0;
      left: 0;
      border-bottom-width: 3px;
      border-left-width: 3px;
    }

    &.bottom-right {
      bottom: 0;
      right: 0;
      border-bottom-width: 3px;
      border-right-width: 3px;
    }
  }

  .scan-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(
      90deg,
      transparent,
      #1976d2,
      #1976d2,
      transparent
    );
    animation: scanMove 2s ease-in-out infinite;
  }
}

@keyframes scanMove {
  0%,
  100% {
    top: 0;
  }
  50% {
    top: 100%;
  }
}

.stop-btn {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  .van-icon {
    font-size: 28px;
    color: #fff;
  }
}

.result-section {
  padding: 16px;
}

.result-card {
  border-radius: 12px;
  border-left: 4px solid;
  padding: 16px;

  .result-status {
    font-size: 22px;
    font-weight: bold;
    margin-bottom: 8px;
  }

  .result-code {
    font-size: 14px;
    color: #fff;
    font-family: monospace;
    margin-bottom: 4px;
    word-break: break-all;
  }

  .result-time {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
  }
}

.input-section {
  padding: 16px;
  background: #1a1a1a;

  .input-label {
    font-size: 12px;
    color: #999;
    margin-bottom: 8px;
  }

  .input-row {
    display: flex;
    gap: 12px;

    .code-input {
      flex: 1;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 16px;
      color: #fff;
      outline: none;

      &::placeholder {
        color: rgba(255, 255, 255, 0.4);
      }
    }

    .verify-btn {
      background: #1976d2;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 0 24px;
      font-size: 16px;
      cursor: pointer;

      &:active {
        background: #1565c0;
      }
    }
  }
}
</style>
