import React, { useState, useCallback, useMemo } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  Node,
  Edge,
  ConnectionLineType,
  Panel,
  useReactFlow,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  Box, 
  AppBar, 
  Toolbar, 
  Typography, 
  TextField, 
  Button,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Tooltip,
} from '@mui/material';
import { 
  CloudDownload as DownloadIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  Storage as StorageIcon,
  Computer as ComputerIcon,
  Cloud as CloudIcon,
  Memory as MemoryIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { toPng } from 'html-to-image';

interface VCenterCredentials {
  host: string;
  username: string;
  password: string;
  port: number;
}

// Custom Node Types
const CustomNode = ({ data }: { data: any }) => {
  const getIcon = () => {
    switch (data.type) {
      case 'vm':
        return <ComputerIcon />;
      case 'host':
        return <MemoryIcon />;
      case 'datastore':
        return <StorageIcon />;
      case 'storagepod':
        return <CloudIcon />;
      default:
        return null;
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        padding: 1,
        minWidth: 200,
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {getIcon()}
        <Typography variant="subtitle2">{data.name}</Typography>
      </Box>
      <Box sx={{ mt: 1 }}>
        {Object.entries(data.data || {}).map(([key, value]) => (
          <Chip
            key={key}
            label={`${key}: ${value}`}
            size="small"
            sx={{ m: 0.5 }}
          />
        ))}
      </Box>
    </Paper>
  );
};

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

const App: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [credentials, setCredentials] = useState<VCenterCredentials>({
    host: '',
    username: '',
    password: '',
    port: 443,
  });
  const [loginOpen, setLoginOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { fitView } = useReactFlow();

  const handleConnect = async () => {
    try {
      const response = await axios.post('http://localhost:8000/api/network-data', credentials);
      const formattedNodes = response.data.nodes.map((node: any) => ({
        ...node,
        type: 'custom',
      }));
      setNodes(formattedNodes);
      setEdges(response.data.edges);
      setLoginOpen(false);
      setTimeout(() => fitView(), 100);
    } catch (error) {
      console.error('Failed to connect:', error);
      alert('Failed to connect to vCenter. Please check your credentials.');
    }
  };

  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setDetailsOpen(true);
  };

  const handleDownload = useCallback(() => {
    const element = document.querySelector('.react-flow') as HTMLElement;
    if (element) {
      toPng(element, {
        backgroundColor: '#ffffff',
      })
        .then((dataUrl) => {
          const link = document.createElement('a');
          link.download = 'infrastructure-diagram.png';
          link.href = dataUrl;
          link.click();
        });
    }
  }, []);

  const filteredNodes = useMemo(() => {
    return nodes.filter(node => 
      node.data.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.data.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [nodes, searchTerm]);

  const filteredEdges = useMemo(() => {
    return edges.filter(edge => 
      filteredNodes.some(node => node.id === edge.source || node.id === edge.target)
    );
  }, [edges, filteredNodes]);

  const getEdgeStyle = (edge: Edge) => ({
    stroke: edge.data?.type === 'storage' ? '#f50057' : '#1976d2',
    strokeWidth: 2,
  });

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            vCenter Infrastructure Mapper
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search infrastructure..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon />,
                sx: { backgroundColor: 'white', borderRadius: 1 }
              }}
            />
            <Tooltip title="Export Diagram">
              <IconButton color="inherit" onClick={handleDownload}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Filter View">
              <IconButton color="inherit">
                <FilterIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ flexGrow: 1 }}>
        <ReactFlow
          nodes={filteredNodes}
          edges={filteredEdges}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          connectionLineType={ConnectionLineType.SmoothStep}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: true,
          }}
          edgeOptions={{
            type: 'smoothstep',
            animated: true,
          }}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
          <Panel position="top-left">
            <Paper sx={{ p: 1, m: 1 }}>
              <Typography variant="caption">
                Connection Types:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Chip
                  size="small"
                  label="Compute"
                  sx={{ backgroundColor: '#1976d2', color: 'white' }}
                />
                <Chip
                  size="small"
                  label="Storage"
                  sx={{ backgroundColor: '#f50057', color: 'white' }}
                />
              </Box>
            </Paper>
          </Panel>
        </ReactFlow>
      </Box>

      <Dialog open={loginOpen} onClose={() => {}}>
        <DialogTitle>Connect to vCenter</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Host"
              value={credentials.host}
              onChange={(e) => setCredentials({ ...credentials, host: e.target.value })}
            />
            <TextField
              label="Username"
              value={credentials.username}
              onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
            />
            <TextField
              label="Password"
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
            />
            <TextField
              label="Port"
              type="number"
              value={credentials.port}
              onChange={(e) => setCredentials({ ...credentials, port: parseInt(e.target.value) })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConnect} variant="contained">
            Connect
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer
        anchor="right"
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
      >
        <Box sx={{ width: 350, p: 2 }}>
          {selectedNode && (
            <>
              <Typography variant="h6" gutterBottom>
                {selectedNode.data.name}
              </Typography>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Type: {selectedNode.data.type}
              </Typography>
              <List>
                {Object.entries(selectedNode.data.data || {}).map(([key, value]) => (
                  <ListItem key={key}>
                    <ListItemText
                      primary={key.replace(/_/g, ' ').toUpperCase()}
                      secondary={value}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </Box>
      </Drawer>
    </Box>
  );
};

export default App;
