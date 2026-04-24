<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

useHead({
  title: "扫码验票",
});
import jsQR from "jsqr";

interface ScanResult {
  ok: boolean;
  status: string;
  participant?: {
    name: string;
    school: string;
  };
}

interface ScanRecord {
  code: string;
  status: string;
  time: string;
  name?: string;
  school?: string;
}

const scanning = ref(false);
const successCount = ref(0);
const showResult = ref(false);
const resultStatus = ref<"success" | "used" | "expired" | "invalid">("invalid");
const resultMessage = ref("");
const resultParticipant = ref<{ name: string; school: string } | null>(null);
const scanRecords = ref<ScanRecord[]>([]);
const showRecords = ref(false);

let videoElement: HTMLVideoElement | null = null;
let canvasElement: HTMLCanvasElement | null = null;
let canvasContext: CanvasRenderingContext2D | null = null;
let stream: MediaStream | null = null;
let animationId: number | null = null;
let lastScannedCode = "";
let lastScanTime = 0;
let resultTimeout: ReturnType<typeof setTimeout> | null = null;

const getAuthHeaders = () => {
  const adminToken = localStorage.getItem("adminToken");
  const inspectorToken = localStorage.getItem("inspectorToken");

  if (adminToken) {
    return { "x-admin-token": adminToken };
  }

  if (inspectorToken) {
    return { "x-inspector-token": inspectorToken };
  }

  navigateTo("/admin");
  return {};
};

const showResultPopup = (
  status: "success" | "used" | "expired" | "invalid",
  message: string,
  participant?: { name: string; school: string },
) => {
  if (resultTimeout) {
    clearTimeout(resultTimeout);
  }

  resultStatus.value = status;
  resultMessage.value = message;
  resultParticipant.value = participant || null;
  showResult.value = true;

  resultTimeout = setTimeout(() => {
    showResult.value = false;
  }, 2000);
};

const verifyTicket = async (code: string) => {
  const now = Date.now();
  if (code === lastScannedCode && now - lastScanTime < 3000) {
    return;
  }
  lastScannedCode = code;
  lastScanTime = now;

  try {
    const res = await $fetch<ScanResult>("/api/admin/verify", {
      method: "POST",
      headers: getAuthHeaders(),
      body: { ticketCode: code },
    });

    if (res.ok) {
      successCount.value++;
      showResultPopup("success", "可通行", res.participant);
    } else {
      const status = res.status as "used" | "expired";
      showResultPopup(
        status === "used" ? "used" : "expired",
        status === "used" ? "已使用" : "已过期",
        res.participant,
      );
    }

    scanRecords.value.unshift({
      code,
      status: res.ok ? "success" : res.status,
      time: new Date().toLocaleTimeString(),
      name: res.participant?.name,
      school: res.participant?.school,
    });
  } catch (e) {
    showResultPopup("invalid", "无效门票");

    scanRecords.value.unshift({
      code,
      status: "invalid",
      time: new Date().toLocaleTimeString(),
    });
  }
};

const tick = () => {
  if (!videoElement || !canvasElement || !canvasContext || !scanning.value) {
    return;
  }

  if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    canvasContext.drawImage(
      videoElement,
      0,
      0,
      canvasElement.width,
      canvasElement.height,
    );
    const imageData = canvasContext.getImageData(
      0,
      0,
      canvasElement.width,
      canvasElement.height,
    );
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    if (code && code.data) {
      verifyTicket(code.data);
    }
  }
  animationId = requestAnimationFrame(tick);
};

const startCamera = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    videoElement = document.querySelector("#scan-video");
    canvasElement = document.createElement("canvas");
    canvasContext = canvasElement.getContext("2d");

    if (videoElement) {
      videoElement.srcObject = stream;
      await videoElement.play();
      scanning.value = true;
      animationId = requestAnimationFrame(tick);
    }
  } catch (e) {
    showResultPopup("invalid", "无法访问摄像头");
  }
};

const stopCamera = () => {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  scanning.value = false;
};

const goBack = () => {
  stopCamera();
  if (localStorage.getItem("adminToken")) {
    navigateTo("/admin");
  } else {
    localStorage.removeItem("inspectorToken");
    localStorage.removeItem("inspectorName");
    navigateTo("/admin");
  }
};

const manualCode = ref("");
const handleManualInput = () => {
  if (!manualCode.value.trim()) {
    showResultPopup("invalid", "请输入门票码");
    return;
  }
  verifyTicket(manualCode.value.trim());
  manualCode.value = "";
};

const openRecords = () => {
  showRecords.value = true;
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    success: "#4caf50",
    used: "#ff9800",
    expired: "#f44336",
    invalid: "#9e9e9e",
  };
  return colors[status] || "#9e9e9e";
};

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    success: "可通行",
    used: "已使用",
    expired: "已过期",
    invalid: "无效",
  };
  return texts[status] || "未知";
};

onMounted(() => {
  const adminToken = localStorage.getItem("adminToken");
  const inspectorToken = localStorage.getItem("inspectorToken");
  if (!adminToken && !inspectorToken) {
    navigateTo("/admin");
  }
});

onUnmounted(() => {
  stopCamera();
  if (resultTimeout) {
    clearTimeout(resultTimeout);
  }
});
</script>

<template>
  <div class="scan-page">
    <div class="scan-header">
      <div class="header-left" @click="goBack">
        <van-icon name="arrow-left" />
        <span>返回</span>
      </div>
      <div class="header-center">
        <span class="count-label">已检票</span>
        <span class="count">{{ successCount }}</span>
      </div>
      <div class="header-right" @click="openRecords">
        <van-icon name="orders-o" />
        <span>记录</span>
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

    <div class="input-section">
      <div class="input-row">
        <input
          v-model="manualCode"
          type="text"
          class="code-input"
          placeholder="输入电子门票验证码"
          @keyup.enter="handleManualInput"
        />
        <button class="verify-btn" @click="handleManualInput">验证</button>
      </div>
    </div>

    <Transition name="result-fade">
      <div v-if="showResult" class="result-popup" :class="resultStatus">
        <div class="result-icon">
          <van-icon v-if="resultStatus === 'success'" name="passed" />
          <van-icon v-else name="close" />
        </div>
        <div class="result-text">{{ resultMessage }}</div>
        <div v-if="resultParticipant" class="result-info">
          <span class="name">{{ resultParticipant.name }}</span>
          <span class="school">{{ resultParticipant.school }}</span>
        </div>
      </div>
    </Transition>

    <van-popup
      v-model:show="showRecords"
      position="bottom"
      round
      :style="{ height: '70%' }"
    >
      <div class="records-popup">
        <div class="records-header">
          <h3>检票记录</h3>
        </div>
        <div class="records-body">
          <div v-if="scanRecords.length === 0" class="empty-records">
            暂无检票记录
          </div>
          <div
            v-for="(record, index) in scanRecords"
            :key="index"
            class="record-item"
          >
            <div class="record-left">
              <div
                class="record-status"
                :style="{ color: getStatusColor(record.status) }"
              >
                {{ getStatusText(record.status) }}
              </div>
              <div
                v-if="record.name || record.school"
                class="record-participant"
              >
                <span v-if="record.name">{{ record.name }}</span>
                <span v-if="record.name && record.school"> · </span>
                <span v-if="record.school">{{ record.school }}</span>
              </div>
              <div class="record-code">{{ record.code }}</div>
            </div>
            <div class="record-time">{{ record.time }}</div>
          </div>
        </div>
        <div class="records-footer">
          <van-button block round @click="showRecords = false">关闭</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped lang="scss">
.scan-page {
  min-height: 100vh;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
  position: relative;
}

.scan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  position: relative;
  z-index: 10;

  .header-left,
  .header-right {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font-size: 14px;
    color: #666;
  }

  .header-center {
    display: flex;
    flex-direction: column;
    align-items: center;

    .count-label {
      font-size: 12px;
      color: #999;
    }

    .count {
      font-size: 28px;
      font-weight: bold;
      color: #4caf50;
    }
  }
}

.camera-section {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #fff;
  margin: 12px;
  border-radius: 16px;
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
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 16px;

  .overlay-content {
    text-align: center;

    .scan-icon {
      font-size: 80px;
      color: #1976d2;
      margin-bottom: 16px;
    }

    .scan-text {
      font-size: 18px;
      color: #333;
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
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

  .van-icon {
    font-size: 24px;
    color: #333;
  }
}

.input-section {
  padding: 16px;
  background: #fff;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);

  .input-row {
    display: flex;
    gap: 12px;

    .code-input {
      flex: 1;
      background: #f5f5f5;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 16px;
      color: #333;
      outline: none;

      &:focus {
        border-color: #1976d2;
        background: #fff;
      }

      &::placeholder {
        color: #999;
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

.result-popup {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #fff;
  border-radius: 16px;
  padding: 32px 48px;
  text-align: center;
  z-index: 100;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);

  &.success {
    .result-icon {
      color: #4caf50;
    }
    .result-text {
      color: #4caf50;
    }
  }

  &.used,
  &.expired,
  &.invalid {
    .result-icon {
      color: #f44336;
    }
    .result-text {
      color: #f44336;
    }
  }

  .result-icon {
    font-size: 56px;
    margin-bottom: 12px;
  }

  .result-text {
    font-size: 22px;
    font-weight: bold;
    margin-bottom: 8px;
  }

  .result-info {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 14px;
    color: #666;

    .name {
      font-weight: 500;
    }

    .school {
      color: #999;
    }
  }
}

.result-fade-enter-active,
.result-fade-leave-active {
  transition: opacity 0.3s ease;
}

.result-fade-enter-from,
.result-fade-leave-to {
  opacity: 0;
}

.records-popup {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.records-header {
  padding: 16px;
  text-align: center;
  border-bottom: 1px solid #eee;

  h3 {
    margin: 0;
    font-size: 18px;
    color: #333;
  }
}

.records-body {
  flex: 1;
  padding: 12px;
  overflow-y: auto;

  .empty-records {
    text-align: center;
    color: #999;
    padding: 40px;
  }
}

.record-item {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;

  .record-left {
    flex: 1;
  }

  .record-status {
    font-size: 15px;
    font-weight: bold;
    margin-bottom: 4px;
  }

  .record-participant {
    font-size: 13px;
    color: #666;
    margin-bottom: 4px;
  }

  .record-code {
    font-size: 12px;
    color: #999;
    font-family: monospace;
    word-break: break-all;
  }

  .record-time {
    font-size: 12px;
    color: #999;
    white-space: nowrap;
    margin-left: 12px;
  }
}

.records-footer {
  padding: 16px;
  border-top: 1px solid #eee;
}
</style>
