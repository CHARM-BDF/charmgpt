import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

const KnowledgeGraphVisualizer = () => {
    const svgRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

    // State for graph data
    const [graphData, setGraphData] = useState({
        nodes: [
            { id: 'concept-1', name: 'Artificial Intelligence', group: 1, type: 'group', collapsed: false },
            { id: 'concept-2', name: 'Machine Learning', group: 1, parentId: 'concept-1' },
            { id: 'concept-3', name: 'Neural Networks', group: 2, parentId: 'concept-2' },
            { id: 'concept-4', name: 'Natural Language Processing', group: 2, parentId: 'concept-1' },
            { id: 'concept-5', name: 'Computer Vision', group: 3, parentId: 'concept-1' },
            { id: 'concept-6', name: 'Deep Learning', group: 2, parentId: 'concept-3' },
            { id: 'concept-7', name: 'Reinforcement Learning', group: 2, parentId: 'concept-2' },
        ],
        links: [
            { source: 'concept-1', target: 'concept-2', label: 'includes' },
            { source: 'concept-2', target: 'concept-3', label: 'uses' },
            { source: 'concept-2', target: 'concept-4', label: 'enables' },
            { source: 'concept-1', target: 'concept-5', label: 'involves' },
            { source: 'concept-4', target: 'concept-5', label: 'complements' },
            { source: 'concept-3', target: 'concept-6', label: 'includes' },
            { source: 'concept-2', target: 'concept-7', label: 'includes' },
        ]
    });

    // State for selected node/link for operations
    const [selectedElement, setSelectedElement] = useState(null);

    // Helper function to get visible nodes based on collapsed state
    const getVisibleNodes = (nodes) => {
        // Get all collapsed group nodes
        const collapsedGroups = nodes
            .filter(node => node.type === 'group' && node.collapsed)
            .map(node => node.id);

        // Return only nodes that don't have a collapsed parent
        return nodes.filter(node => !node.parentId || !collapsedGroups.includes(node.parentId));
    };

    // Helper function to get visible links based on visible nodes
    const getVisibleLinks = (links, visibleNodes) => {
        const visibleNodeIds = visibleNodes.map(node => node.id);
        return links.filter(link =>
            visibleNodeIds.includes(link.source.id || link.source) &&
            visibleNodeIds.includes(link.target.id || link.target)
        );
    };

    // Mock a tool call to LLM/MCP
    const updateGraphViaMCP = async (operation, data) => {
        console.log(`Calling MCP tool: ${operation}`, data);

        // Simulate delay for MCP call
        await new Promise(resolve => setTimeout(resolve, 800));

        // Handle different operations
        switch (operation) {
            case 'ADD_NODE':
                setGraphData(prevData => ({
                    ...prevData,
                    nodes: [...prevData.nodes, {
                        id: `concept-${prevData.nodes.length + 1}`,
                        name: data.name,
                        group: data.group || Math.ceil(Math.random() * 3),
                        parentId: data.parentId || null
                    }]
                }));
                break;

            case 'ADD_RELATIONSHIP':
                setGraphData(prevData => ({
                    ...prevData,
                    links: [...prevData.links, {
                        source: data.source,
                        target: data.target,
                        label: data.label
                    }]
                }));
                break;

            case 'DELETE_NODE':
                setGraphData(prevData => {
                    // Get all children of the node to delete
                    const childIds = [data.nodeId];
                    let foundMore = true;

                    // Find all descendants recursively
                    while (foundMore) {
                        const newChildIds = prevData.nodes
                            .filter(node => node.parentId && childIds.includes(node.parentId))
                            .map(node => node.id);

                        foundMore = newChildIds.length > 0;
                        childIds.push(...newChildIds);
                    }

                    return {
                        nodes: prevData.nodes.filter(node => !childIds.includes(node.id)),
                        links: prevData.links.filter(link =>
                            !(childIds.includes(link.source.id || link.source) ||
                                childIds.includes(link.target.id || link.target)))
                    };
                });
                break;

            case 'DELETE_RELATIONSHIP':
                setGraphData(prevData => ({
                    ...prevData,
                    links: prevData.links.filter((link, index) => index !== data.linkIndex)
                }));
                break;

            case 'CREATE_GROUP':
                setGraphData(prevData => {
                    // Create a new group node
                    const groupNode = {
                        id: `group-${prevData.nodes.length + 1}`,
                        name: data.name,
                        group: data.group || Math.ceil(Math.random() * 3),
                        type: 'group',
                        collapsed: false
                    };

                    // Update child nodes to reference the new group
                    const updatedNodes = prevData.nodes.map(node =>
                        data.childIds.includes(node.id) ? { ...node, parentId: groupNode.id } : node
                    );

                    return {
                        ...prevData,
                        nodes: [...updatedNodes, groupNode]
                    };
                });
                break;

            case 'TOGGLE_GROUP':
                setGraphData(prevData => ({
                    ...prevData,
                    nodes: prevData.nodes.map(node =>
                        node.id === data.groupId ?
                            { ...node, collapsed: data.collapsed ?? !node.collapsed } :
                            node
                    )
                }));
                break;

            case 'REMOVE_FROM_GROUP':
                setGraphData(prevData => ({
                    ...prevData,
                    nodes: prevData.nodes.map(node =>
                        node.id === data.nodeId ? { ...node, parentId: null } : node
                    )
                }));
                break;

            default:
                console.log('Unknown operation');
        }
    };

    // Initialize and update the D3 visualization
    useEffect(() => {
        if (!svgRef.current || !graphData.nodes.length) return;

        // Get visible nodes and links based on collapsed state
        const visibleNodes = getVisibleNodes(graphData.nodes);
        const visibleLinks = getVisibleLinks(graphData.links, visibleNodes);

        // Clear any existing visualization
        d3.select(svgRef.current).selectAll("*").remove();

        // Create a new SVG
        const svg = d3.select(svgRef.current)
            .attr("width", dimensions.width)
            .attr("height", dimensions.height);

        // Add zoom and pan behavior
        const g = svg.append("g");
        svg.call(d3.zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            }));

        // Define arrow markers for the links
        svg.append("defs").selectAll("marker")
            .data(["end"])
            .enter().append("marker")
            .attr("id", String)
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", d => 25)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "#999");

        // Create the link group
        const link = g.append("g")
            .attr("class", "links")
            .selectAll("g")
            .data(visibleLinks)
            .enter().append("g");

        // Add the actual link lines
        link.append("path")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.3)
            .attr("stroke-width", 1.5)
            .attr("fill", "none")
            .attr("marker-end", "url(#end)")
            .on("click", (event, d) => {
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                
                // Log edge coordinates
                console.log(`📍 Edge Coordinates:`);
                console.log(`   Source: x=${d.source.x?.toFixed(2) || 'N/A'}, y=${d.source.y?.toFixed(2) || 'N/A'}, z=${d.source.z?.toFixed(2) || 'N/A'}`);
                console.log(`   Target: x=${d.target.x?.toFixed(2) || 'N/A'}, y=${d.target.y?.toFixed(2) || 'N/A'}, z=${d.target.z?.toFixed(2) || 'N/A'}`);
                
                // Calculate midpoint
                const midX = d.source.x && d.target.x ? ((d.source.x + d.target.x) / 2).toFixed(2) : 'N/A';
                const midY = d.source.y && d.target.y ? ((d.source.y + d.target.y) / 2).toFixed(2) : 'N/A';
                const midZ = d.source.z && d.target.z ? ((d.source.z + d.target.z) / 2).toFixed(2) : 'N/A';
                console.log(`   Midpoint: x=${midX}, y=${midY}, z=${midZ}`);
                console.log('');
                
                console.log(`🔗 EDGE: ${d.source.id || d.source} → ${d.target.id || d.target}`);
                console.log(`🏷️  Label: ${d.label || 'No label'}`);
                
                console.log('');
                console.log('Full edge object:', d);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                
                setSelectedElement({ type: 'link', data: d });
                event.stopPropagation();
            });

        // Add link labels
        link.append("text")
            .text(d => d.label)
            .attr("font-size", 10)
            .attr("text-anchor", "middle")
            .attr("dy", -5)
            .attr("fill", "#666");

        // Create the node group
        const node = g.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(visibleNodes)
            .enter().append("g")
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        // Define color scale
        const color = d3.scaleOrdinal(d3.schemeCategory10);

        // Add the node circles with different sizes based on type
        node.append("circle")
            .attr("r", d => d.type === 'group' ? 15 : 8)
            .attr("fill", d => color(d.group))
            .attr("stroke", d => {
                if (d.type === 'group') return "#333";
                if (d.data?.seedNode) return "#000000";
                return "none";
            })
            .attr("stroke-width", d => {
                if (d.type === 'group') return 2;
                if (d.data?.seedNode) return 4;
                return 0;
            });

        // Add halo effect for seed nodes
        node.filter(d => d.data?.seedNode)
            .append("circle")
            .attr("r", d => (d.type === 'group' ? 15 : 8) + 4)
            .attr("fill", "none")
            .attr("stroke", "rgba(0, 0, 0, 0.3)")
            .attr("stroke-width", 8)
            .lower(); // Put halo behind the main node

        // Add click handlers to nodes
        node.on("click", (event, d) => {
                setSelectedElement({ type: 'node', data: d });
                event.stopPropagation();
            })
            .on("dblclick", (event, d) => {
                // Double-click to toggle group collapse
                if (d.type === 'group') {
                    updateGraphViaMCP('TOGGLE_GROUP', { groupId: d.id });
                    event.stopPropagation();
                }
            });

        // Bring seed nodes to the front
        node.filter(d => d.data?.seedNode)
            .raise();

        // Add indicators for group nodes
        node.filter(d => d.type === 'group')
            .append("text")
            .text(d => d.collapsed ? "+" : "-")
            .attr("font-size", 18)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("fill", "white")
            .attr("font-weight", "bold")
            .style("pointer-events", "none");

        // Add node labels
        node.append("text")
            .text(d => d.name)
            .attr("font-size", 12)
            .attr("x", d => d.type === 'group' ? 18 : 12)
            .attr("dy", ".35em")
            .attr("font-weight", d => d.type === 'group' ? "bold" : "normal");

        // Define the simulation with adjusted forces based on node types
        const simulation = d3.forceSimulation(visibleNodes)
            .force("link", d3.forceLink(visibleLinks).id(d => d.id).distance(d => {
                // Longer distances for links connected to group nodes
                const isGroupLink = d.source.type === 'group' || d.target.type === 'group';
                return isGroupLink ? 200 : 150;
            }))
            .force("charge", d3.forceManyBody().strength(d =>
                // Stronger repulsion for group nodes
                d.type === 'group' ? -500 : -300
            ))
            .force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
            .force("collide", d3.forceCollide().radius(d =>
                // Larger collision radius for group nodes
                d.type === 'group' ? 50 : 30
            ))
            .on("tick", ticked);

        // Handle click outside to deselect
        svg.on("click", () => setSelectedElement(null));

        // Update positions on each tick of the simulation
        function ticked() {
            link.selectAll("path")
                .attr("d", d => {
                    const dx = d.target.x - d.source.x;
                    const dy = d.target.y - d.source.y;
                    const dr = Math.sqrt(dx * dx + dy * dy);
                    return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
                });

            link.selectAll("text")
                .attr("x", d => (d.source.x + d.target.x) / 2)
                .attr("y", d => (d.source.y + d.target.y) / 2);

            node.attr("transform", d => `translate(${d.x},${d.y})`);
        }

        // Drag functionality
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        // Cleanup function
        return () => {
            simulation.stop();
        };
    }, [graphData, dimensions, getVisibleNodes, getVisibleLinks, updateGraphViaMCP]);

    // Resize handler to make visualization responsive
    useEffect(() => {
        const handleResize = () => {
            const container = svgRef.current?.parentElement;
            if (container) {
                setDimensions({
                    width: container.clientWidth,
                    height: container.clientHeight || 600
                });
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Actions panel component for node/link operations
    const ActionsPanel = () => {
        const [newNodeName, setNewNodeName] = useState('');
        const [newRelationship, setNewRelationship] = useState({
            source: '',
            target: '',
            label: ''
        });
        const [newGroup, setNewGroup] = useState({
            name: '',
            selectedNodes: []
        });
        const [activeTab, setActiveTab] = useState('add');

        if (!selectedElement) {
            return (
                <div className="p-4 bg-gray-100 rounded-md">
                    <h3 className="font-bold mb-3">Graph Operations</h3>

                    <div className="flex mb-4 border-b">
                        <button
                            className={`px-3 py-1 mr-2 ${activeTab === 'add' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                            onClick={() => setActiveTab('add')}
                        >
                            Add
                        </button>
                        <button
                            className={`px-3 py-1 ${activeTab === 'group' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                            onClick={() => setActiveTab('group')}
                        >
                            Groups
                        </button>
                    </div>

                    {activeTab === 'add' && (
                        <>
                            <div className="mb-4">
                                <h4 className="font-semibold mb-1">Add New Node</h4>
                                <input
                                    type="text"
                                    value={newNodeName}
                                    onChange={e => setNewNodeName(e.target.value)}
                                    placeholder="Node name"
                                    className="w-full p-2 border rounded mb-2"
                                />

                                <select
                                    className="w-full p-2 border rounded mb-2"
                                    onChange={e => setNewNodeGroup(e.target.value)}
                                    defaultValue=""
                                >
                                    <option value="">Add as root node</option>
                                    {graphData.nodes
                                        .filter(node => node.type === 'group')
                                        .map(node => (
                                            <option key={`parent-${node.id}`} value={node.id}>
                                                Add to group: {node.name}
                                            </option>
                                        ))
                                    }
                                </select>

                                <button
                                    onClick={() => {
                                        if (newNodeName.trim()) {
                                            const nodeParams = {
                                                name: newNodeName,
                                                parentId: newNodeGroup || null
                                            };
                                            updateGraphViaMCP('ADD_NODE', nodeParams);
                                            setNewNodeName('');
                                            setNewNodeGroup('');
                                        }
                                    }}
                                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                                >
                                    Add Node
                                </button>
                            </div>

                            <div>
                                <h4 className="font-semibold mb-1">Add Relationship</h4>
                                <select
                                    value={newRelationship.source}
                                    onChange={e => setNewRelationship({ ...newRelationship, source: e.target.value })}
                                    className="w-full p-2 border rounded mb-2"
                                >
                                    <option value="">Select source node</option>
                                    {graphData.nodes.map(node => (
                                        <option key={`source-${node.id}`} value={node.id}>{node.name}</option>
                                    ))}
                                </select>

                                <select
                                    value={newRelationship.target}
                                    onChange={e => setNewRelationship({ ...newRelationship, target: e.target.value })}
                                    className="w-full p-2 border rounded mb-2"
                                >
                                    <option value="">Select target node</option>
                                    {graphData.nodes.map(node => (
                                        <option key={`target-${node.id}`} value={node.id}>{node.name}</option>
                                    ))}
                                </select>

                                <input
                                    type="text"
                                    value={newRelationship.label}
                                    onChange={e => setNewRelationship({ ...newRelationship, label: e.target.value })}
                                    placeholder="Relationship label"
                                    className="w-full p-2 border rounded mb-2"
                                />

                                <button
                                    onClick={() => {
                                        if (newRelationship.source && newRelationship.target && newRelationship.label) {
                                            updateGraphViaMCP('ADD_RELATIONSHIP', newRelationship);
                                            setNewRelationship({ source: '', target: '', label: '' });
                                        }
                                    }}
                                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                                >
                                    Add Relationship
                                </button>
                            </div>
                        </>
                    )}

                    {activeTab === 'group' && (
                        <>
                            <div className="mb-4">
                                <h4 className="font-semibold mb-1">Create Group</h4>
                                <input
                                    type="text"
                                    value={newGroup.name}
                                    onChange={e => setNewGroup({ ...newGroup, name: e.target.value })}
                                    placeholder="Group name"
                                    className="w-full p-2 border rounded mb-2"
                                />

                                <div className="mb-2 max-h-40 overflow-y-auto border rounded p-2">
                                    {graphData.nodes
                                        .filter(node => !node.type) // Only show non-group nodes
                                        .map(node => (
                                            <div key={`select-${node.id}`} className="flex items-center mb-1">
                                                <input
                                                    type="checkbox"
                                                    id={`node-${node.id}`}
                                                    checked={newGroup.selectedNodes.includes(node.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setNewGroup({
                                                                ...newGroup,
                                                                selectedNodes: [...newGroup.selectedNodes, node.id]
                                                            });
                                                        } else {
                                                            setNewGroup({
                                                                ...newGroup,
                                                                selectedNodes: newGroup.selectedNodes.filter(id => id !== node.id)
                                                            });
                                                        }
                                                    }}
                                                    className="mr-2"
                                                />
                                                <label htmlFor={`node-${node.id}`}>{node.name}</label>
                                            </div>
                                        ))
                                    }
                                </div>

                                <button
                                    onClick={() => {
                                        if (newGroup.name.trim() && newGroup.selectedNodes.length > 0) {
                                            updateGraphViaMCP('CREATE_GROUP', {
                                                name: newGroup.name,
                                                childIds: newGroup.selectedNodes
                                            });
                                            setNewGroup({ name: '', selectedNodes: [] });
                                        }
                                    }}
                                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                                    disabled={!newGroup.name.trim() || newGroup.selectedNodes.length === 0}
                                >
                                    Create Group
                                </button>
                            </div>

                            <div>
                                <h4 className="font-semibold mb-1">Manage Groups</h4>
                                <div className="border rounded p-2 max-h-40 overflow-y-auto">
                                    {graphData.nodes
                                        .filter(node => node.type === 'group')
                                        .map(group => (
                                            <div key={`group-${group.id}`} className="flex justify-between items-center mb-2 p-1 border-b">
                                                <div>
                                                    <strong>{group.name}</strong>
                                                    <button
                                                        onClick={() => updateGraphViaMCP('TOGGLE_GROUP', {
                                                            groupId: group.id,
                                                            collapsed: !group.collapsed
                                                        })}
                                                        className="ml-2 px-2 py-0 bg-gray-200 text-xs rounded"
                                                    >
                                                        {group.collapsed ? 'Expand' : 'Collapse'}
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={() => updateGraphViaMCP('DELETE_NODE', { nodeId: group.id })}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        </>
                    )}
                </div>
            );
        }

        // Show details and actions for selected element
        return (
            <div className="p-4 bg-gray-100 rounded-md">
                <h3 className="font-bold mb-2">
                    Selected {selectedElement.type === 'node' ?
                        (selectedElement.data.type === 'group' ? 'Group' : 'Node') :
                        'Relationship'}
                </h3>

                {selectedElement.type === 'node' && (
                    <div>
                        <p className="mb-2"><strong>Name:</strong> {selectedElement.data.name}</p>
                        <p className="mb-2"><strong>ID:</strong> {selectedElement.data.id}</p>
                        {selectedElement.data.type === 'group' ? (
                            <>
                                <p className="mb-2"><strong>Type:</strong> Group</p>
                                <p className="mb-2"><strong>Status:</strong> {selectedElement.data.collapsed ? 'Collapsed' : 'Expanded'}</p>

                                <div className="flex space-x-2 mb-4">
                                    <button
                                        onClick={() => {
                                            updateGraphViaMCP('TOGGLE_GROUP', {
                                                groupId: selectedElement.data.id,
                                                collapsed: !selectedElement.data.collapsed
                                            });
                                        }}
                                        className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                                    >
                                        {selectedElement.data.collapsed ? 'Expand' : 'Collapse'}
                                    </button>

                                    <button
                                        onClick={() => {
                                            updateGraphViaMCP('DELETE_NODE', { nodeId: selectedElement.data.id });
                                            setSelectedElement(null);
                                        }}
                                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                                    >
                                        Delete Group
                                    </button>
                                </div>

                                <div>
                                    <h4 className="font-semibold mb-1">Group Members</h4>
                                    <div className="max-h-40 overflow-y-auto border rounded p-2">
                                        {graphData.nodes
                                            .filter(node => node.parentId === selectedElement.data.id)
                                            .map(node => (
                                                <div key={`member-${node.id}`} className="flex justify-between items-center mb-1">
                                                    <span>{node.name}</span>
                                                    <button
                                                        onClick={() => updateGraphViaMCP('REMOVE_FROM_GROUP', { nodeId: node.id })}
                                                        className="text-red-500 hover:text-red-700 text-xs"
                                                        title="Remove from group"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="mb-2"><strong>Group:</strong> {selectedElement.data.group}</p>
                                {selectedElement.data.parentId && (
                                    <p className="mb-2">
                                        <strong>Parent Group:</strong> {
                                            graphData.nodes.find(n => n.id === selectedElement.data.parentId)?.name || 'Unknown'
                                        }
                                    </p>
                                )}

                                <div className="flex space-x-2 mt-4 mb-2">
                                    {selectedElement.data.parentId && (
                                        <button
                                            onClick={() => {
                                                updateGraphViaMCP('REMOVE_FROM_GROUP', { nodeId: selectedElement.data.id });
                                                setSelectedElement(null);
                                            }}
                                            className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                                        >
                                            Remove from Group
                                        </button>
                                    )}

                                    <button
                                        onClick={() => {
                                            updateGraphViaMCP('DELETE_NODE', { nodeId: selectedElement.data.id });
                                            setSelectedElement(null);
                                        }}
                                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                                    >
                                        Delete Node
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {selectedElement.type === 'link' && (
                    <div>
                        <p className="mb-2"><strong>From:</strong> {selectedElement.data.source.name || selectedElement.data.source}</p>
                        <p className="mb-2"><strong>To:</strong> {selectedElement.data.target.name || selectedElement.data.target}</p>
                        <p className="mb-4"><strong>Relationship:</strong> {selectedElement.data.label}</p>

                        <button
                            onClick={() => {
                                // Find the index of this link
                                const linkIndex = graphData.links.findIndex(
                                    link => link === selectedElement.data
                                );
                                updateGraphViaMCP('DELETE_RELATIONSHIP', { linkIndex });
                                setSelectedElement(null);
                            }}
                            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                        >
                            Delete Relationship
                        </button>
                    </div>
                )}

                <button
                    onClick={() => setSelectedElement(null)}
                    className="mt-2 bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600"
                >
                    Close
                </button>
            </div>
        );
    };

    return (
        <div className="flex h-screen">
            <div className="flex-grow relative">
                <svg ref={svgRef} className="w-full h-full"></svg>
            </div>
            <div className="w-80 p-4 border-l border-gray-200">
                <ActionsPanel />
            </div>
        </div>
    );
};

export default KnowledgeGraphVisualizer;