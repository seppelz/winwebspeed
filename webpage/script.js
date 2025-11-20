// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      const offsetTop = target.offsetTop - 80;
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });
    }
  });
});

// Navbar background on scroll
const navbar = document.querySelector('.navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
  const currentScroll = window.pageYOffset;
  
  if (currentScroll > 50) {
    navbar.style.background = 'rgba(255, 255, 255, 0.98)';
    navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
  } else {
    navbar.style.background = 'rgba(255, 255, 255, 0.95)';
    navbar.style.boxShadow = 'none';
  }
  
  lastScroll = currentScroll;
});

// Intersection Observer for fade-in animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, observerOptions);

// Observe elements for animation
document.addEventListener('DOMContentLoaded', () => {
  const animatedElements = document.querySelectorAll('.feature-card, .step, .download-card');
  animatedElements.forEach(el => {
    observer.observe(el);
  });
});

// Update download links when GitHub releases are available
// This can be updated to fetch from GitHub API
function updateDownloadLinks() {
  // Example: Fetch from GitHub releases API
  // fetch('https://api.github.com/repos/username/webspeed/releases/latest')
  //   .then(response => response.json())
  //   .then(data => {
  //     const installerLink = data.assets.find(asset => asset.name.includes('Setup'));
  //     const portableLink = data.assets.find(asset => asset.name.includes('portable') || !asset.name.includes('Setup'));
  //     
  //     if (installerLink) {
  //       document.querySelectorAll('.download-card:first-child .btn-primary').forEach(btn => {
  //         btn.href = installerLink.browser_download_url;
  //       });
  //     }
  //     if (portableLink) {
  //       document.querySelectorAll('.download-card:last-child .btn-secondary').forEach(btn => {
  //         btn.href = portableLink.browser_download_url;
  //       });
  //     }
  //   })
  //   .catch(error => console.error('Error fetching releases:', error));
}

// Call when page loads
// updateDownloadLinks();

// Animate taskbar overlay preview values
function animateOverlayPreview() {
  // Overlay elements
  const overlayDownloadElement = document.getElementById('overlay-download-speed');
  const overlayUploadElement = document.getElementById('overlay-upload-speed');
  const overlayDownloadProgress = document.getElementById('overlay-download-progress-fill');
  const overlayUploadProgress = document.getElementById('overlay-upload-progress-fill');
  const overlayCpuElement = document.getElementById('overlay-cpu-usage');
  const overlayRamElement = document.getElementById('overlay-ram-usage');
  const overlayCpuProcess = document.getElementById('overlay-cpu-process');
  const overlayCpuProcessUsage = document.getElementById('overlay-cpu-process-usage');
  const overlayRamProcess = document.getElementById('overlay-ram-process');
  const overlayRamProcessUsage = document.getElementById('overlay-ram-process-usage');
  
  // Stats window elements
  const previewDownloadElement = document.getElementById('preview-download-speed');
  const previewUploadElement = document.getElementById('preview-upload-speed');
  const previewDownloadProgress = document.getElementById('preview-download-progress-fill');
  const previewUploadProgress = document.getElementById('preview-upload-progress-fill');
  const previewCpuElement = document.getElementById('preview-cpu-usage');
  const previewRamElement = document.getElementById('preview-ram-usage');
  const previewCpuTemp = document.getElementById('preview-cpu-temperature');
  const previewCpuProcessName = document.getElementById('preview-cpu-process-name');
  const previewCpuProcessUsage = document.getElementById('preview-cpu-process-usage');
  const previewRamProcessName = document.getElementById('preview-ram-process-name');
  const previewRamProcessUsage = document.getElementById('preview-ram-process-usage');
  
  if (!overlayDownloadElement || !overlayUploadElement || !overlayDownloadProgress || !overlayUploadProgress) {
    return;
  }
  
  // Demo data patterns for realistic animation
  const downloadPatterns = [
    { base: 0, peak: 5, duration: 2000 },
    { base: 5, peak: 25, duration: 3000 },
    { base: 25, peak: 45, duration: 4000 },
    { base: 45, peak: 60, duration: 3000 },
    { base: 60, peak: 35, duration: 2500 },
    { base: 35, peak: 12, duration: 2000 },
    { base: 12, peak: 0, duration: 1500 }
  ];
  
  const uploadPatterns = [
    { base: 0, peak: 2, duration: 1500 },
    { base: 2, peak: 8, duration: 2500 },
    { base: 8, peak: 15, duration: 3000 },
    { base: 15, peak: 22, duration: 2500 },
    { base: 22, peak: 12, duration: 2000 },
    { base: 12, peak: 5, duration: 1800 },
    { base: 5, peak: 0, duration: 1200 }
  ];
  
  let downloadIndex = 0;
  let uploadIndex = 0;
  let downloadStartTime = Date.now();
  let uploadStartTime = Date.now();
  
  const maxSpeedMbps = 100; // Max speed for progress bar calculation
  
  function updateDownload() {
    const now = Date.now();
    const elapsed = now - downloadStartTime;
    const pattern = downloadPatterns[downloadIndex];
    
    if (elapsed >= pattern.duration) {
      downloadIndex = (downloadIndex + 1) % downloadPatterns.length;
      downloadStartTime = now;
      return updateDownload();
    }
    
    const progress = elapsed / pattern.duration;
    const speed = pattern.base + (pattern.peak - pattern.base) * Math.sin(progress * Math.PI);
    const speedMbps = Math.max(0, speed);
    const speedText = speedMbps.toFixed(1);
    const progressPercent = Math.min((speedMbps / maxSpeedMbps) * 100, 100);
    
    // Update overlay
    overlayDownloadElement.textContent = speedText;
    overlayDownloadProgress.style.width = `${progressPercent}%`;
    
    // Update stats window
    if (previewDownloadElement) {
      previewDownloadElement.textContent = speedText;
      previewDownloadElement.classList.add('updating');
      setTimeout(() => previewDownloadElement.classList.remove('updating'), 200);
    }
    if (previewDownloadProgress) {
      previewDownloadProgress.style.width = `${progressPercent}%`;
    }
  }
  
  function updateUpload() {
    const now = Date.now();
    const elapsed = now - uploadStartTime;
    const pattern = uploadPatterns[uploadIndex];
    
    if (elapsed >= pattern.duration) {
      uploadIndex = (uploadIndex + 1) % uploadPatterns.length;
      uploadStartTime = now;
      return updateUpload();
    }
    
    const progress = elapsed / pattern.duration;
    const speed = pattern.base + (pattern.peak - pattern.base) * Math.sin(progress * Math.PI);
    const speedMbps = Math.max(0, speed);
    const speedText = speedMbps.toFixed(1);
    const progressPercent = Math.min((speedMbps / maxSpeedMbps) * 100, 100);
    
    // Update overlay
    overlayUploadElement.textContent = speedText;
    overlayUploadProgress.style.width = `${progressPercent}%`;
    
    // Update stats window
    if (previewUploadElement) {
      previewUploadElement.textContent = speedText;
      previewUploadElement.classList.add('updating');
      setTimeout(() => previewUploadElement.classList.remove('updating'), 200);
    }
    if (previewUploadProgress) {
      previewUploadProgress.style.width = `${progressPercent}%`;
    }
  }
  
  // Animate CPU and RAM with subtle variations
  let cpuBase = 38.7;
  let ramBase = 51.8;
  let cpuDirection = 1;
  let ramDirection = -1;
  let cpuTemp = 52.3;
  let cpuTempDirection = 1;
  let cpuProcessUsage = 7.5;
  let ramProcessUsage = 1192.0;
  
  function updateCPU() {
    cpuBase += cpuDirection * 0.1;
    if (cpuBase > 42 || cpuBase < 35) {
      cpuDirection *= -1;
    }
    
    // Update CPU temperature
    cpuTemp += cpuTempDirection * 0.05;
    if (cpuTemp > 55 || cpuTemp < 48) {
      cpuTempDirection *= -1;
    }
    
    // Update CPU process usage (relative to CPU usage)
    cpuProcessUsage = cpuBase * 0.2 + Math.sin(Date.now() / 2000) * 2;
    cpuProcessUsage = Math.max(3, Math.min(15, cpuProcessUsage));
    
    const cpuText = cpuBase.toFixed(1);
    const cpuTempText = cpuTemp.toFixed(1);
    const cpuProcessText = cpuProcessUsage.toFixed(1);
    
    // Update overlay
    if (overlayCpuElement) {
      overlayCpuElement.textContent = cpuText;
    }
    if (overlayCpuProcessUsage) {
      overlayCpuProcessUsage.textContent = `(${cpuProcessText}%)`;
    }
    
    // Update stats window
    if (previewCpuElement) {
      previewCpuElement.textContent = cpuText;
      previewCpuElement.classList.add('updating');
      setTimeout(() => previewCpuElement.classList.remove('updating'), 200);
    }
    if (previewCpuTemp) {
      previewCpuTemp.textContent = cpuTempText;
    }
    if (previewCpuProcessUsage) {
      previewCpuProcessUsage.textContent = `CPU: ${cpuProcessText}%`;
    }
  }
  
  function updateRAM() {
    ramBase += ramDirection * 0.15;
    if (ramBase > 55 || ramBase < 48) {
      ramDirection *= -1;
    }
    
    // Update RAM process usage (relative to RAM usage)
    ramProcessUsage = 1000 + (ramBase - 50) * 50 + Math.sin(Date.now() / 3000) * 100;
    ramProcessUsage = Math.max(800, Math.min(1500, ramProcessUsage));
    
    const ramText = ramBase.toFixed(1);
    const ramProcessText = ramProcessUsage.toFixed(1);
    
    // Update overlay
    if (overlayRamElement) {
      overlayRamElement.textContent = ramText;
    }
    if (overlayRamProcessUsage) {
      overlayRamProcessUsage.textContent = `(${ramProcessText}MB)`;
    }
    
    // Update stats window
    if (previewRamElement) {
      previewRamElement.textContent = ramText;
      previewRamElement.classList.add('updating');
      setTimeout(() => previewRamElement.classList.remove('updating'), 200);
    }
    if (previewRamProcessUsage) {
      previewRamProcessUsage.textContent = `Memory: ${ramProcessText} MB`;
    }
  }
  
  // Update every 100ms for smooth animation
  setInterval(() => {
    updateDownload();
    updateUpload();
    updateCPU();
    updateRAM();
  }, 100);
}

// Initialize overlay animation when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for the overlay to be rendered
  setTimeout(() => {
    animateOverlayPreview();
  }, 500);
});

