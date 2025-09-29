# LTE PCI Conflict Mapper

An advanced LTE Physical Cell Identity (PCI) conflict detection and visualization tool powered by ArcGIS mapping, Firebase backend, and Gemini AI recommendations.

## 🚀 Features

### Core Functionality
- **PCI Conflict Detection**: Automatic detection of Mod3, Mod6, Mod12, and Mod30 conflicts
- **Interactive Mapping**: Visual representation using ArcGIS with conflict severity highlighting
- **AI-Powered Analysis**: Gemini AI integration for intelligent recommendations
- **Real-time Visualization**: Dynamic conflict severity mapping with color-coded indicators
- **Data Export**: Comprehensive analysis export in JSON format

### Technical Capabilities
- LTE PCI conflict algorithms based on 3GPP standards
- Haversine distance calculations for geographic analysis
- Signal strength and interference modeling
- Automated PCI suggestion algorithms
- Network optimization recommendations

## 🛠️ Technology Stack

- **Frontend**: SvelteKit with TypeScript
- **Mapping**: ArcGIS JavaScript API 4.32
- **Backend**: Firebase (Firestore, Authentication, Storage)
- **AI**: Gemini AI for intelligent analysis
- **Styling**: Custom CSS with ArcGIS theme integration
- **Build Tool**: Vite

## 📋 Prerequisites

- Node.js 20.0+
- npm 10.0+
- Firebase account with configured project
- ArcGIS Developer account with API key
- Gemini AI API access

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-repo/pci-mapper.git
   cd pci-mapper
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Firebase Configuration
   PUBLIC_FIREBASE_API_KEY="your-firebase-api-key"
   PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
   PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
   PUBLIC_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
   PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
   PUBLIC_FIREBASE_APP_ID="your-app-id"
   PUBLIC_FIREBASE_MEASUREMENT_ID="your-measurement-id"

   # ArcGIS Configuration
   PUBLIC_ARCGIS_API_KEY="your-arcgis-api-key"

   # Gemini AI Configuration
   PUBLIC_GEMINI_API_KEY="your-gemini-api-key"
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open browser**
   Navigate to `http://localhost:5173`

## 🎯 Usage

### Basic Functionality
1. **Load Sample Data**: Click "Load Sample Data" to start with example LTE cells
2. **Run Analysis**: Execute conflict detection across the network
3. **Visualize Conflicts**: View conflicts on the interactive map
4. **Review Recommendations**: Get AI-powered optimization suggestions

### Advanced Features
- **Custom Data Import**: Import your own cell tower data
- **Advanced Filtering**: Filter conflicts by severity and type
- **Export Analysis**: Download comprehensive reports
- **Real-time Updates**: Live conflict monitoring

## 🗺️ PCI Conflict Types

### MOD3 Conflicts
- **Impact**: Cell Reference Signal (CRS) collision
- **Detection**: Cells with same PCI % 3 value
- **Severity**: High impact on signal quality

### MOD6 Conflicts  
- **Impact**: PBCH (Physical Broadcast Channel) interference
- **Detection**: Cells with same PCI % 6 value
- **Severity**: Medium-high impact on system information

### MOD12 Conflicts
- **Impact**: PSS/SSS interference  
- **Detection**: Cells with same PCI % 12 value
- **Severity**: Medium impact on synchronization

### MOD30 Conflicts
- **Impact**: PRS interference
- **Detection**: Cells with same PCI % 30 value  
- **Severity**: Low-medium impact on positioning

## 🔍 Conflict Severity Levels

- **CRITICAL**: Distance < 500m, Signal difference < 6dB
- **HIGH**: Distance < 1000m, Signal difference < 9dB
- **MEDIUM**: Distance < 2000m, Signal difference < 12dB
- **LOW**: Distance < 3000m, Signal difference > 12dB

## 🚀 Best Firebase IDE Recommendations

### 1. **VS Code with Firebase Extensions** ⭐ (Recommended)
- **Extensions**: Firebase, Live Server, Thunder Client
- **Features**: Excellent SvelteKit support, integrated debugging
- **Pros**: Lightweight, extensive extension ecosystem
- **Perfect for**: Full-stack development with real-time features

### 2. **JetBrains WebStorm**
- **Built-in**: Firebase integration, advanced debugging
- **Features**: Professional IDE with comprehensive tooling
- **Pros**: Powerful refactoring, built-in terminal
- **Perfect for**: Enterprise development environments

### 3. **Gitpod/Codespaces** 
- **Cloud-based**: Pre-configured development environments
- **Features**: Instant setup, collaborative coding
- **Pros**: No local configuration, shared workspaces
- **Perfect for**: Team development and rapid prototyping

### 4. **Firebase Web Editor (Built-in)**
- **Simple**: Basic web-based IDE
- **Features**: Direct Firebase project editing
- **Pros**: No setup required
- **Perfect for**: Quick edits and simple functions

## 📊 Project Structure

```
src/
├── lib/
│   ├── firebase.ts          # Firebase configuration
│   ├── pciMapper.ts         # PCI conflict detection algorithms
│   ├── arcgisMap.ts         # ArcGIS mapping integration
│   ├── geminiService.ts     # AI analysis service
│   └── config.ts           # Environment configuration
├── routes/
│   ├── +layout.svelte      # Main application layout
│   └── +page.svelte        # Primary application interface
├── app.html                # HTML template
└── app.css                # Global styles and ArcGIS theming
```

## 🔧 Configuration

### Firebase Setup
1. Create a new Firebase project
2. Enable Firestore Database
3. Configure Authentication (if needed)
4. Generate API keys and update configuration

### ArcGIS Setup  
1. Sign up for ArcGIS Developer account
2. Create a new application
3. Generate API key
4. Configure referer restrictions

### Gemini AI Setup
1. Access Google AI Studio
2. Create API key
3. Enable Gemini API
4. Configure usage limits

## 📈 Performance Optimization

- **Map Clustering**: Automatic point clustering for dense deployments
- **Lazy Loading**: On-demand conflict analysis
- **Caching**: Local storage for repeated analyses
- **Efficient Rendering**: Optimized ArcGIS layer management

## 🧪 Testing

```bash
# Run linting
npm run check

# Format code
npm run format

# Type checking
npm run check:watch
```

## 🚀 Deployment

### Firebase Hosting
```bash
npm run build
firebase deploy
```

### Vercel/Netlify
```bash
npm run build
# Deploy dist folder
```

## 📝 API Documentation

### PCI Conflict Detection
```typescript
interface Cell {
  id: string;
  eNodeB: number;
  sector: number;
  pci: number;
  latitude: number;
  longitude: number;
  frequency: number;
  rsPower: number;
}

interface PCIConflict {
  primaryCell: Cell;
  conflictingCell: Cell;
  conflictType: 'MOD3' | 'MOD6' | 'MOD12' | 'MOD30';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  distance: number;
}
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Email**: support@pci-mapper.com
- **Documentation**: [Wiki](https://github.com/your-repo/pci-mapper/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-repo/pci-mapper/issues)

## 🙏 Acknowledgments

- ArcGIS JavaScript API team
- Firebase team for excellent backend services
- Google Gemini AI team
- LTE/5G community for technical standards
- Svelte team for the amazing framework

---

**Built with ❤️ for the LTE networking community**
