# SplitSnap - Smart Receipt Scanner & Bill Splitter

## 🎯 What is SplitSnap?

SplitSnap is an intelligent web application that automatically scans receipts using OCR (Optical Character Recognition) and helps you split bills among friends. Simply take a photo or upload a receipt image, and the app will:

- **Extract text** from receipt images using advanced OCR
- **Identify items** and their prices automatically
- **Split bills** among multiple people with smart calculations
- **Generate payment links** and QR codes for easy money transfers
- **Track expenses** and provide spending insights

## 🚀 How to Run the Project

### Prerequisites

- Node.js (version 16 or higher)
- npm (comes with Node.js)

### Environment Setup

Create a `.env` file in the root directory with the following variables:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OCR Configuration
OCR_SPACE_API_KEY=your_ocr_space_api_key

# Server Configuration
PORT=3003
NODE_ENV=development
```

**Important**: Replace the placeholder values with your actual API keys and credentials.

### Getting API Keys

- **Supabase**: Create a project at [supabase.com](https://supabase.com) and get your project URL and keys from the project settings
- **OCR.space**: Sign up at [ocr.space](https://ocr.space) to get your free API key (1000 requests/month)

### Quick Start

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd splitsnap-simple
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run the application**

   ```bash
   npm run both
   ```

   This will start both the backend server and frontend client simultaneously.

### Alternative: Run Separately

- **Backend Server Only**: `npm run server` (runs on port 3003)
- **Frontend Client Only**: `npm run client` (runs on port 3002)

### Access the Application

- **Frontend**: Open [http://localhost:3002](http://localhost:3002) in your browser
- **Backend API**: Available at [http://localhost:3003](http://localhost:3003)

## 🏗️ Project Structure

```
splitsnap-simple/
├── client/                 # Frontend (HTML, CSS, JavaScript)
│   ├── index.html         # Main application interface
│   ├── styles.css         # Styling and responsive design
│   ├── script.js          # Main application logic
│   ├── auth.js            # Authentication service
│   └── demo-data.js       # Demo data for testing
├── server/                 # Backend (Node.js, Express)
│   ├── server.js          # Main server file
│   └── services/          # Business logic services
├── database/               # Database schema and migrations
└── package.json            # Project dependencies and scripts
```

## 🔧 Key Features

- **OCR Processing**: Uses OCR.space API and Tesseract.js for text extraction
- **Smart Bill Splitting**: Automatically calculates individual shares
- **Payment Integration**: Generates UPI links and QR codes
- **Responsive Design**: Works perfectly on mobile, tablet, and desktop
- **Demo Mode**: Fully functional demo with sample data
- **Real-time Updates**: Live expense tracking and calculations

## 🧪 Testing the Application

1. **Demo Mode**: The app includes a demo mode with sample receipts and data
2. **Upload Images**: Test with any receipt image (JPG, PNG)
3. **Bill Splitting**: Add participants and split bills automatically
4. **Payment Links**: Generate and test payment sharing features

## 🌟 Technical Highlights

- **Frontend**: Vanilla JavaScript with modern ES6+ features
- **Backend**: Node.js with Express.js framework
- **OCR**: Multiple OCR engines for reliability
- **Security**: XSS protection, input validation, secure API endpoints
- **Performance**: Optimized image processing and efficient rendering
- **Accessibility**: WCAG 2.2+ compliant with ARIA labels

## 📱 Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🚨 Troubleshooting

- **Port conflicts**: If ports 3002/3003 are busy, kill existing processes
- **Dependencies**: Run `npm install` if you encounter module errors
- **Server issues**: Check console for error messages

## 📄 License

MIT License - Feel free to use, modify, and distribute!

---

**Built with ❤️ for smart expense management**
