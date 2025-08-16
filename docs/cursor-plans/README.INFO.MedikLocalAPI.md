# mediKanren API Server Guide

## Overview

mediKanren is a biomedical reasoning system that provides a REST API server implementing the [TRAPI (Translator Reasoner API) 1.1](https://github.com/NCATSTranslator/ReasonerAPI) standard. It can perform queries over medical knowledge graphs using miniKanren + heuristics + indexing.

## Prerequisites

- **Racket** programming language installed
- **Database(s)** configured (SemMed, RTX-KG2, etc.)
- **Configuration file** set up

## Starting the Server

### Quick Start

```bash
cd medikanren2
racket server.rkt
```

The server will start on **port 8384** by default.

### Configuration

1. Copy the default configuration:
   ```bash
   cp etc/config.defaults.scm config.scm
   ```

2. Edit `config.scm` to specify your databases:
   ```scheme
   (
    (databases . (rtx2-20210204 semmed))
    ;; Add other configuration overrides here
   )
   ```

## API Endpoints

### Main Query Endpoints

- **`POST /query`** - Legacy endpoint (TRAPI 1.0)
- **`POST /v2/query`** - Current endpoint (TRAPI 1.1) 
- **`POST /pmi/v2/query`** - Web application endpoint

### Utility Endpoints

- **`GET /`** - Web UI for testing queries
- **`GET /health`** - Health check
- **`GET /schema.json`** - OpenAPI schema (JSON)
- **`GET /schema.yaml`** - OpenAPI schema (YAML)
- **`GET /pmi/v2/ingest-pipeline/status`** - Pipeline status

## Query Format (TRAPI 1.1)

Queries use the TRAPI standard format with a `message` containing a `query_graph`.

### Basic Query Structure

```json
{
  "message": {
    "query_graph": {
      "nodes": {
        "node_id": {
          "ids": ["CURIE:ID"],
          "categories": ["biolink:Category"]
        }
      },
      "edges": {
        "edge_id": {
          "subject": "source_node_id",
          "object": "target_node_id",
          "predicates": ["biolink:predicate"]
        }
      }
    }
  }
}
```

### Query Examples

#### Example 1: Find proteins that interact with a specific compound

```json
{
  "message": {
    "query_graph": {
      "nodes": {
        "n0": {
          "ids": ["CHEMBL.COMPOUND:CHEMBL112"]
        },
        "n1": {
          "categories": ["biolink:Protein"]
        }
      },
      "edges": {
        "e00": {
          "subject": "n0",
          "object": "n1",
          "predicates": ["biolink:physically_interacts_with"]
        }
      }
    }
  }
}
```

#### Example 2: Find diseases treated by a drug and genes associated with those diseases

```json
{
  "message": {
    "query_graph": {
      "nodes": {
        "n0": {
          "ids": ["UMLS:C0520909"]
        },
        "n1": {
          "categories": ["biolink:Disease"]
        },
        "n2": {
          "categories": ["biolink:Gene"]
        }
      },
      "edges": {
        "e01": {
          "subject": "n0",
          "object": "n1"
        },
        "e21": {
          "subject": "n2",
          "object": "n1"
        }
      }
    }
  }
}
```

## Response Format

The server returns TRAPI-compliant responses with the following structure:

### Success Response (HTTP 200)

```json
{
  "message": {
    "query_graph": { /* Original query graph */ },
    "knowledge_graph": {
      "nodes": {
        "node_id": {
          "name": "Node Name",
          "categories": ["biolink:Category"],
          "attributes": [
            {
              "name": "attribute_name",
              "type": "attribute_type",
              "value": "attribute_value"
            }
          ]
        }
      },
      "edges": {
        "edge_id": {
          "subject": "source_node_id",
          "object": "target_node_id",
          "predicate": "biolink:predicate",
          "attributes": [
            {
              "name": "attribute_name",
              "type": "attribute_type", 
              "value": "attribute_value"
            }
          ]
        }
      }
    },
    "results": [
      {
        "node_bindings": {
          "query_node_id": [
            {
              "id": "knowledge_graph_node_id"
            }
          ]
        },
        "edge_bindings": {
          "query_edge_id": [
            {
              "id": "knowledge_graph_edge_id"
            }
          ]
        }
      }
    ]
  },
  "status": "Success",
  "description": "Success. X results.",
  "logs": [
    {
      "level": "INFO",
      "message": "Query time: Xms"
    }
  ]
}
```

### Error Responses

- **HTTP 400**: Bad request (invalid query format)
- **HTTP 500**: Internal server error
- **HTTP 501**: Not implemented

## Making Queries

### Using cURL

```bash
curl -X POST http://localhost:8384/v2/query \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "query_graph": {
        "nodes": {
          "n0": {"ids": ["CHEMBL.COMPOUND:CHEMBL112"]},
          "n1": {"categories": ["biolink:Protein"]}
        },
        "edges": {
          "e00": {
            "subject": "n0",
            "object": "n1",
            "predicates": ["biolink:physically_interacts_with"]
          }
        }
      }
    }
  }'
```

### Using Python

```python
import requests
import json

query = {
    "message": {
        "query_graph": {
            "nodes": {
                "n0": {"ids": ["CHEMBL.COMPOUND:CHEMBL112"]},
                "n1": {"categories": ["biolink:Protein"]}
            },
            "edges": {
                "e00": {
                    "subject": "n0",
                    "object": "n1",
                    "predicates": ["biolink:physically_interacts_with"]
                }
            }
        }
    }
}

response = requests.post(
    "http://localhost:8384/v2/query",
    headers={"Content-Type": "application/json"},
    json=query
)

result = response.json()
print(json.dumps(result, indent=2))
```

## Server Features

- **Sequential Processing**: Queries are processed one at a time
- **Query Timeout**: 10-minute limit per query
- **Multi-Database Support**: Can query across multiple knowledge sources
- **Lightweight Reasoning**: Supports synonym resolution and subclass inference
- **Web UI**: Built-in interface for testing at `http://localhost:8384/`

## Health Check

Check if the server is running:

```bash
curl http://localhost:8384/health
```

Returns timing information and server status.

## Supported Knowledge Sources

- **SemMed**: Semantic MEDLINE database
- **RTX-KG2**: Reasoning Tool X Knowledge Graph 2
- **KGX Synonyms**: Synonym mappings

## Query Optimization

- Use specific CURIEs when possible for better performance
- Limit result sets with `max_results` parameter
- Consider query complexity for timeout limits

## Troubleshooting

1. **Server won't start**: Check database configuration in `config.scm`
2. **Query timeout**: Simplify query or increase timeout in server configuration
3. **No results**: Verify CURIEs and categories are correct
4. **Database errors**: Ensure databases are properly loaded and accessible

## More Information

- [TRAPI Specification](https://github.com/NCATSTranslator/ReasonerAPI)
- [Biolink Model](https://biolink.github.io/biolink-model/)
- [mediKanren GitHub](https://github.com/webyrd/mediKanren) 