# vCenter Network Mapper

A modern web application for visualizing and managing vCenter network topology with interactive filtering and diagram export capabilities.

## Features

- Connect to vCenter and retrieve network topology data
- Interactive network visualization using React Flow
- Filter assets to scope the architecture
- Export diagrams for presentations
- Modern UI with Material-UI components
- Real-time search and filtering capabilities

## Prerequisites

- Python 3.8+
- Node.js 16+
- vCenter Server access

## Setup

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment and activate it:
```bash
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Start the backend server:
```bash
uvicorn main:app --reload
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

## Usage

1. Open your browser and navigate to the frontend application (usually http://localhost:5173)
2. Enter your vCenter credentials in the login dialog
3. Once connected, you'll see the network topology visualization
4. Use the search bar to filter nodes by name or type
5. Use the download button to export the current view as an image
6. Use the filter button to apply additional filtering options

## Architecture

- Backend: FastAPI with pyVmomi for vCenter integration
- Frontend: React with TypeScript
- UI Components: Material-UI
- Network Visualization: React Flow
- API Communication: Axios

## License

MIT
