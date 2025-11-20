# WebSpeed Website

A polished, modern website for promoting the WebSpeed application.

## Features

- **Modern Design**: Clean, professional layout with gradient accents
- **Responsive**: Works perfectly on desktop, tablet, and mobile devices
- **Fast Loading**: Optimized CSS and minimal JavaScript
- **SEO Friendly**: Proper meta tags and semantic HTML
- **GitHub Pages Ready**: Can be easily hosted on GitHub Pages

## Structure

```
webpage/
├── index.html      # Main HTML file
├── styles.css      # All styling
├── script.js       # Interactive features
└── README.md       # This file
```

## Hosting on GitHub Pages

1. Push the `webpage` folder to your GitHub repository
2. Go to repository Settings → Pages
3. Select the branch and folder (`/webpage`)
4. Your site will be available at `https://username.github.io/repository-name/`

## Custom Domain

To use a custom domain:

1. Add a `CNAME` file in the `webpage` folder with your domain name
2. Configure DNS records:
   - Type: `CNAME`
   - Name: `@` or `www`
   - Value: `username.github.io`
3. Update the domain in GitHub Pages settings

## Customization

### Update Download Links

Edit `script.js` and uncomment the `updateDownloadLinks()` function, then update with your GitHub repository details:

```javascript
fetch('https://api.github.com/repos/YOUR_USERNAME/YOUR_REPO/releases/latest')
```

### Update Colors

Edit CSS variables in `styles.css`:

```css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  /* ... */
}
```

### Update Content

Edit `index.html` to customize:
- Hero section text
- Features descriptions
- About section
- Footer links

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## License

 (MIT)

