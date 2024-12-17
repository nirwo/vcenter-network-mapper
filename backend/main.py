from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import ssl
from pyVmomi import vim
from pyVim.connect import SmartConnect, Disconnect
import os
from dotenv import load_dotenv

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VCenterCredentials(BaseModel):
    host: str
    username: str
    password: str
    port: int = 443

class NetworkNode(BaseModel):
    id: str
    type: str
    name: str
    data: Dict
    position: Dict

class NetworkEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str = "smoothstep"

class NetworkData(BaseModel):
    nodes: List[NetworkNode]
    edges: List[NetworkEdge]

def get_vcenter_connection(credentials: VCenterCredentials):
    try:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS)
        context.verify_mode = ssl.CERT_NONE
        
        si = SmartConnect(
            host=credentials.host,
            user=credentials.username,
            pwd=credentials.password,
            port=credentials.port,
            sslContext=context
        )
        return si
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to vCenter: {str(e)}")

def get_network_data(si) -> NetworkData:
    content = si.RetrieveContent()
    container = content.rootFolder
    view_type = [vim.VirtualMachine, vim.HostSystem, vim.Network, vim.Datastore, vim.StoragePod, vim.ComputeResource]
    recursive = True
    container_view = content.viewManager.CreateContainerView(container, view_type, recursive)
    
    nodes = []
    edges = []
    node_map = {}
    
    # Process all objects
    for obj in container_view.view:
        if isinstance(obj, vim.VirtualMachine):
            node_id = f"vm-{obj._moId}"
            node_map[node_id] = {
                "id": node_id,
                "type": "vm",
                "name": obj.name,
                "data": {
                    "status": str(obj.runtime.powerState),
                    "cpu": obj.config.hardware.numCPU if obj.config else None,
                    "memory": obj.config.hardware.memoryMB if obj.config else None,
                    "guest_os": obj.config.guestFullName if obj.config else None,
                    "ip_address": obj.guest.ipAddress if obj.guest else None,
                }
            }
        elif isinstance(obj, vim.HostSystem):
            node_id = f"host-{obj._moId}"
            node_map[node_id] = {
                "id": node_id,
                "type": "host",
                "name": obj.name,
                "data": {
                    "status": str(obj.runtime.connectionState),
                    "cpu": obj.hardware.cpuInfo.numCpuCores if obj.hardware else None,
                    "memory": obj.hardware.memorySize // (1024*1024) if obj.hardware else None,
                    "vendor": obj.hardware.systemInfo.vendor if obj.hardware else None,
                    "model": obj.hardware.systemInfo.model if obj.hardware else None,
                }
            }
        elif isinstance(obj, vim.Datastore):
            node_id = f"datastore-{obj._moId}"
            capacity = obj.summary.capacity if obj.summary.capacity else 0
            freeSpace = obj.summary.freeSpace if obj.summary.freeSpace else 0
            node_map[node_id] = {
                "id": node_id,
                "type": "datastore",
                "name": obj.name,
                "data": {
                    "type": obj.summary.type,
                    "capacity_gb": capacity // (1024*1024*1024),
                    "free_space_gb": freeSpace // (1024*1024*1024),
                    "accessible": obj.summary.accessible,
                }
            }
        elif isinstance(obj, vim.StoragePod):
            node_id = f"storagepod-{obj._moId}"
            node_map[node_id] = {
                "id": node_id,
                "type": "storagepod",
                "name": obj.name,
                "data": {
                    "total_capacity": sum([child.summary.capacity for child in obj.childEntity if hasattr(child.summary, 'capacity')]) // (1024*1024*1024),
                }
            }
    
    # Process connections
    for obj in container_view.view:
        if isinstance(obj, vim.VirtualMachine):
            vm_id = f"vm-{obj._moId}"
            
            # Connect VM to Host
            if obj.runtime.host:
                host_id = f"host-{obj.runtime.host._moId}"
                edges.append({
                    "id": f"edge-{vm_id}-{host_id}",
                    "source": vm_id,
                    "target": host_id,
                    "type": "compute",
                })
            
            # Connect VM to Datastores
            for datastore in obj.datastore:
                datastore_id = f"datastore-{datastore._moId}"
                edges.append({
                    "id": f"edge-{vm_id}-{datastore_id}",
                    "source": vm_id,
                    "target": datastore_id,
                    "type": "storage",
                })
        
        elif isinstance(obj, vim.HostSystem):
            host_id = f"host-{obj._moId}"
            
            # Connect Host to Datastores
            for datastore in obj.datastore:
                datastore_id = f"datastore-{datastore._moId}"
                edges.append({
                    "id": f"edge-{host_id}-{datastore_id}",
                    "source": host_id,
                    "target": datastore_id,
                    "type": "storage",
                })
        
        elif isinstance(obj, vim.Datastore):
            datastore_id = f"datastore-{obj._moId}"
            
            # Connect Datastore to Storage Pod if applicable
            if hasattr(obj, 'parent') and isinstance(obj.parent, vim.StoragePod):
                storagepod_id = f"storagepod-{obj.parent._moId}"
                edges.append({
                    "id": f"edge-{datastore_id}-{storagepod_id}",
                    "source": datastore_id,
                    "target": storagepod_id,
                    "type": "storage",
                })
    
    # Position nodes in a hierarchical layout
    levels = {
        'storagepod': 0,
        'datastore': 1,
        'host': 2,
        'vm': 3
    }
    
    level_counts = {level: 0 for level in levels.keys()}
    for node in node_map.values():
        level = levels.get(node['type'], 0)
        count = level_counts[node['type']]
        
        # Position nodes in a grid based on their type
        node["position"] = {
            "x": count * 250,
            "y": level * 200
        }
        level_counts[node['type']] += 1
        nodes.append(node)
    
    return NetworkData(nodes=nodes, edges=edges)

@app.post("/api/network-data")
async def get_network_topology(credentials: VCenterCredentials):
    si = get_vcenter_connection(credentials)
    try:
        network_data = get_network_data(si)
        return network_data
    finally:
        Disconnect(si)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
