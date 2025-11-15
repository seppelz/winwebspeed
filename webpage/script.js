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

