// Enhanced animations for WinWebSpeed landing page

// Realistic network speed simulation
class NetworkSimulator {
  constructor() {
    this.dlSpeed = 0;
    this.ulSpeed = 0;
    this.cpuUsage = 38.7;
    this.gpuUsage = 25.3;
    this.ramUsage = 51.8;
    this.targetDl = 0;
    this.targetUl = 0;
    this.targetCpu = 38.7;
    this.targetGpu = 25.3;
    this.targetRam = 51.8;

    this.processes = ['chrome', 'firefox', 'code', 'spotify', 'discord', 'teams'];
    this.currentCpuProcess = 'chrome';
    this.currentRamProcess = 'chrome';
  }

  // Generate realistic speed patterns
  generateSpeedPattern() {
    const patterns = [
      { dl: { min: 0, max: 15 }, ul: { min: 0, max: 5 }, duration: 3000 },
      { dl: { min: 15, max: 45 }, ul: { min: 5, max: 15 }, duration: 4000 },
      { dl: { min: 45, max: 75 }, ul: { min: 15, max: 25 }, duration: 3500 },
      { dl: { min: 75, max: 95 }, ul: { min: 25, max: 35 }, duration: 3000 },
      { dl: { min: 50, max: 70 }, ul: { min: 10, max: 20 }, duration: 3500 },
      { dl: { min: 20, max: 40 }, ul: { min: 5, max: 12 }, duration: 3000 },
      { dl: { min: 0, max: 10 }, ul: { min: 0, max: 3 }, duration: 2500 }
    ];

    return patterns[Math.floor(Math.random() * patterns.length)];
  }

  // Smooth interpolation
  lerp(start, end, t) {
    return start + (end - start) * t;
  }

  // Update speeds with smooth transitions
  update(deltaTime) {
    const smoothing = 0.05;

    this.dlSpeed = this.lerp(this.dlSpeed, this.targetDl, smoothing);
    this.ulSpeed = this.lerp(this.ulSpeed, this.targetUl, smoothing);
    this.cpuUsage = this.lerp(this.cpuUsage, this.targetCpu, smoothing * 0.3);
    this.gpuUsage = this.lerp(this.gpuUsage, this.targetGpu, smoothing * 0.25);
    this.ramUsage = this.lerp(this.ramUsage, this.targetRam, smoothing * 0.2);
  }

  // Set new targets
  setNewTargets() {
    const pattern = this.generateSpeedPattern();
    this.targetDl = pattern.dl.min + Math.random() * (pattern.dl.max - pattern.dl.min);
    this.targetUl = pattern.ul.min + Math.random() * (pattern.ul.max - pattern.ul.min);
    this.targetCpu = 25 + Math.random() * 35; // 25-60%
    this.targetGpu = 15 + Math.random() * 45; // 15-60%
    this.targetRam = 40 + Math.random() * 30; // 40-70%

    // Occasionally change process names
    if (Math.random() < 0.3) {
      this.currentCpuProcess = this.processes[Math.floor(Math.random() * this.processes.length)];
    }
    if (Math.random() < 0.2) {
      this.currentRamProcess = this.processes[Math.floor(Math.random() * this.processes.length)];
    }

    return pattern.duration;
  }
}

// Initialize simulator
const simulator = new NetworkSimulator();
let lastTime = Date.now();
let nextTargetTime = Date.now() + simulator.setNewTargets();
let animationFrameId = null;

// Animation loop with error handling
function animate() {
  try {
    const now = Date.now();
    const deltaTime = now - lastTime;
    lastTime = now;

    // Update simulator
    simulator.update(deltaTime);

    // Set new targets when needed
    if (now >= nextTargetTime) {
      const duration = simulator.setNewTargets();
      nextTargetTime = now + duration;
    }

    // Update DOM elements with null checks
    const dlElement = document.getElementById('demo-dl');
    const ulElement = document.getElementById('demo-ul');
    const cpuElement = document.getElementById('demo-cpu');
    const gpuElement = document.getElementById('demo-gpu');
    const ramElement = document.getElementById('demo-ram');
    const dlBar = document.getElementById('demo-dl-bar');
    const ulBar = document.getElementById('demo-ul-bar');
    const cpuProcess = document.getElementById('demo-cpu-process');
    const gpuProcess = document.getElementById('demo-gpu-process');
    const ramProcess = document.getElementById('demo-ram-process');

    if (dlElement && dlBar) {
      dlElement.textContent = simulator.dlSpeed.toFixed(1);
      dlBar.style.width = `${Math.min((simulator.dlSpeed / 100) * 100, 100)}%`;
    }

    if (ulElement && ulBar) {
      ulElement.textContent = simulator.ulSpeed.toFixed(1);
      ulBar.style.width = `${Math.min((simulator.ulSpeed / 100) * 100, 100)}%`;
    }

    if (cpuElement && cpuProcess) {
      cpuElement.textContent = Math.round(simulator.cpuUsage);
      cpuProcess.textContent = simulator.currentCpuProcess;
    }

    if (gpuElement && gpuProcess) {
      gpuElement.textContent = Math.round(simulator.gpuUsage);
      gpuProcess.textContent = '-';
    }

    if (ramElement && ramProcess) {
      ramElement.textContent = Math.round(simulator.ramUsage);
      ramProcess.textContent = simulator.currentRamProcess;
    }

    // Continue animation only if elements exist
    if (dlElement || ulElement || cpuElement || gpuElement || ramElement) {
      animationFrameId = requestAnimationFrame(animate);
    }
  } catch (error) {
    console.error('Error in animation loop:', error);
    // Stop animation on error
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  }
}

// Consolidated DOMContentLoaded handler
document.addEventListener('DOMContentLoaded', () => {
  try {
    // Start animation after a short delay
    setTimeout(() => {
      const dlElement = document.getElementById('demo-dl');
      const ulElement = document.getElementById('demo-ul');
      const cpuElement = document.getElementById('demo-cpu');
      const gpuElement = document.getElementById('demo-gpu');
      const ramElement = document.getElementById('demo-ram');
      
      // Only start animation if demo elements exist
      if (dlElement || ulElement || cpuElement || gpuElement || ramElement) {
        animate();
      }
    }, 500);

    // Smooth scroll for anchor links
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const href = this.getAttribute('href');
        if (href) {
          const target = document.querySelector(href);
          if (target) {
            const offsetTop = target.offsetTop - 80;
            window.scrollTo({
              top: offsetTop,
              behavior: 'smooth'
            });
          }
        }
      });
    });

    // Intersection Observer for scroll animations
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

    // Observe elements for fade-in animation
    const animatedElements = document.querySelectorAll('.benefit-card, .feature-item, .step, .support-card');
    animatedElements.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(el);
    });

    // Navbar scroll effect
    const nav = document.querySelector('.nav');
    if (nav) {
      let lastScroll = 0;

      window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 50) {
          nav.style.background = 'rgba(255, 255, 255, 0.95)';
          nav.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.08)';
        } else {
          nav.style.background = 'rgba(255, 255, 255, 0.8)';
          nav.style.boxShadow = 'none';
        }

        lastScroll = currentScroll;
      });
    }

    // Add hover effects to buttons
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
      button.addEventListener('mouseenter', function () {
        this.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      });
    });

    // FAQ accordion functionality
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
      const question = item.querySelector('.faq-question');
      if (question) {
        question.addEventListener('click', () => {
          const isActive = item.classList.contains('active');

          // Close all items
          faqItems.forEach(i => i.classList.remove('active'));

          // Open clicked item if it wasn't active
          if (!isActive) {
            item.classList.add('active');
          }
        });
      }
    });
  } catch (error) {
    console.error('Error initializing page:', error);
  }
});
