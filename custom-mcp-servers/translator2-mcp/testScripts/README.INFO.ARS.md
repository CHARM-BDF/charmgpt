How to use the Autonomous Relay System (ARS) for NCATS Biomedical Data Translator?
What is ARS?
ARS is a system that allows you to query programmatically the NCATS Biomedical Data Translator and ask scientific questions about various entity categories in the Biomedical field. Those entities are linked to each other through various predicates and constitute the NCATS Biomedical data knowledge graph. The ARS system will orchestrate the different ARAs and produce the coherent merged response. The system will return the response in the form of a knowledge graph that has a particular syntax.

What is the purpose of this document?
For typical usage of Translator, the user interface (https://ui.transltr.io/) is much simpler, and handles much of what is detailed here for the user.  However, if you have a need to submit queries outside of those currently accepted by the user interface or need a closer look at the raw data, it is possible to interact with the ARS directly.
https://ui.transltr.io/
What is ARS?
ARS is a system that allows you to query programmatically the NCATS Biomedical Data Translator and ask scientific questions about various entity categories in the Biomedical field. Those entities are linked to each other through various predicates and constitute the NCATS Biomedical data knowledge graph. The ARS system will orchestrate the different ARAs and produce the coherent merged response. The system will return the response in the form of a knowledge graph that has a particular syntax.
How to access ARS?
The current URL for ARS is https://ars-prod.transltr.io/ .
Building your query message
To query the NCATS Biomedical Translator, the query message should contain the information about your entities of interest in a specifically formatted way. 
Defining entities
Because Biomedical data contains a lot of synonyms, ARS does not work straight up from entity names but requires a CURIE. 
CURIE syntax 
A CURIE is a formatted way to represent the ID of an entity. It is formed by 2 parts: 
[biolink source]:[source ID]. For example, CHEBI:6704 is the  entity corresponding to the ID=6704 in Chemical Entities of Biological Interest (ChEBI). 
Common prefixes include:
CHEBI and CHEMBL for chemicals/drugs
DOID, HP, MONDO for disease/phenotypes
NCBIGENE, HGNC for genes
UniprotKB for proteins
Please note that for some sources the CURIE inference might not be so trivial and we suggest to use the name resolution service to ensure a good ID mapping.
Getting your CURIE for your entity of interest
The name resolution service will attempt to take a plain string (e.g “mebendazole” or “glioblastoma”) and return valid CURIES for that entity.  There is a many-to-many mapping between an entity synonyms and their corresponding IDs (across many databases).. This process facilitates a lot of navigation across synonyms/IDs of the same entity so that they are all grouped in a unified clique. 
Alternatively, the synonyms tab in https://arax.ncats.io/ on the left hand bar under “Tools”, will provide a UI with autocomplete and fuzzy matching that uses the name resolution service along with additional information.

Please note: Since multiple CURIEs can refer to the same concept (e.g. Aspirin as represented by Chembl and PubChem), Translator has built a node normalizer tool to normalize CURIEs being used anywhere in Translator. The node normalizer and the name resolution services use custom-built algorithms to define groups (called cliques) of entities that refer to the same concept by using CURIE mapping information from multiple online databases. In addition, two conflations (GeneProtein and DrugChemical) are available to combine genes with their gene products and to combine various formulations of the same drug. The cliques provided by the name resolution service have been generated with GeneProtein conflation turned on and DrugChemical conflation turned off.  Errors in clique building or conflation are possible; if you spot any examples of CURIEs that should or should not be combined, please report them to the Babel pipeline that is used to build these cliques.
Defining the category of your entity of interest
Whether you are specifying your entity of interest, or just telling in the message on which Biomedical space you would like the response to be in, you will need to specify the category of the entity. 
Common categories include:
ChemicalSubstance
Drug
Disease
PhenotypicFeature
Gene
Protein
AnatomicalEntity
NamedThing (this is a ‘wildcard’ type that may not be supported by all connected tools)
To specify the entity category in the TRAPI message, the prefix will be biolink and the suffix will be your category as reported in the hierarchical visualization of the categories ontology such as biolink:Drug or biolink:NameThing. 
Defining predicates
Each link between 2 entities, called a predicate, can have a different value. If a predicate is specified in the TRAPI message, it must follow a specific syntax with prefix biolink and suffix as reported in the hierarchical visualization of the predicates ontology such as biolink:acts_upstream_of.
Please note that Biolink Model specifies the canonical direction of the predicate that should be used; see biolink.github.io/biolink-model for canonical predicates. 



Message syntax
The Translator Autonomous Relay System takes queries from a user in the form of a TRAPI formatted JSON.  
The message sent to ARS will have the following backbone of nodes and edges which represent a query:
{
  "message": {
    "query_graph": {
      "nodes": {
        "n0": {
          "id": "CHEBI:6704",
          "category": "biolink:ChemicalEntity"
        },
        "n1": {
          "category": "biolink:AnatomicalEntity"
        }
      },
      "edges": {
        "e01": {
          "subject": "n0",
          "object": "n1",
          "predicates": [
            "biolink:related_to"
          ]

        }
      }
    }
  }
}

The following is an example of a query which searches for nodes attached to a single, known entity, in this case Mebendazole (as identified by CHEBI:6704) to unknown entities of a specific type (in this case AnatomicalEntity).  Queries can contain additional complexity such as qualifiers, which provide additional information about the nature of the relationship that the edge is meant to represent.

The highlighted areas are places where changes might be made to this query to search for something different.

Known Node Identifier: This is a specific identifier in the form of a CURIE which tells the system what node exactly we are referring to in our query.  
The type of our known node.  Even though we have specified the identity of this node, the system still expects a category for the purposes of query planning. 
The categoryType of our Unknown Node: This is the same category of object as the type we assigned to our known node, and there is no reason that two nodes of the same type cannot be queries (e.g. looking for gene-gene interactions)
Subject/Object of our edge:  Swapping these would change the directionality of our edge.  In the above example, the edge would go from mebendazole to our unknown nodes of type AnatomicalEntity.  It is not often the case that directionality matters, but it can be changed if desired.
Predicate:  This describes the nature of the relationship between nodes that the edge is meant to represent. The predicate used here, related_to, which is the most general type of relationship.
A full list of node types and their most common prefixes can be found at the bottom of the document here


If you are not using your favorite programmatic language editor to construct your .json message to send to ARS, you can use a free JSON online editor to make sure there is no syntax error. JSONLint  can be useful for identifying issues with the validity of JSON syntax. Paste the entire JSON into the text field and click validate.  It will confirm if the JSON is valid and describe the problem if it is not.
Parametrization
Qualifiers in message and what they are
Several (more complex) examples
You can find many other message examples in a mini hackathon run in 2021. 
Running queries programmatically
ARS useful endpoints
https://ars-prod.transltr.io/ars/api/submit
https://ars-prod.transltr.io/ars/api/messages/<uuid:key>
Python requests

Queries can be submitted via a POST to the submit endpoint, but please consult developers before engaging in programmatic submission of queries as concurrent or rapidly sent requests can cause performance issues.

Results can be received via GET calls to the relevant messages endpoint.  This process is detailed further below.
Python cURL

Interactions with the system via cURL follow the same patterns and caveats as doing so via Requests.
Getting back the results
What is a PK?

A PK is a Primary Key and is the means by which the ARS references the content it stores.  A PK can refer to a parent-level message, of which, there is one per query.  This parent message acts as a container for the child PKs, which correspond to each set of results returned by individual Translator tools or to the merged versions which are created by the ARS from the content of the individual children.
Response format

Responses are in JSON form.  At the top-level, this JSON contains various information about the query or results, including timestamps, status, and other meta-information.  The content of 
fields->data is the actual TRAPI message.  The ?trace=y parameter on the messages endpoint can be used to view the children of a parent or to view an abridged version of a child message with the data field (which is by far the largest) omitted.  This can be useful if you only want to check the status of a message but do not need the full data.  In addition to these methods, a ?compress=y parameter can be used to obtain a gzipped version of a message, which can be useful for programmatic access, as the size of full result sets can often be greater than 100mb

An example of a parent message, viewed with trace:
https://ars-prod.transltr.io/ars/api/messages/83900bd5-793f-4fe6-a5fc-c228b008d802?trace=y 

A child message in abridged form using trace:
https://ars-prod.transltr.io/ars/api/messages/1d3ae928-ec87-4467-8eea-45a332d2fd16?trace=y

The same child message in full (omitting the trace parameter)
https://ars-prod.transltr.io/ars/api/messages/1d3ae928-ec87-4467-8eea-45a332d2fd16

The same child in compressed form (deliberately not hyperlinked as opening the link will start a download of the zipped message)

https://ars-prod.transltr.io/ars/api/messages/1d3ae928-ec87-4467-8eea-45a332d2fd16?compress=y



Waiting for the responses to be completed

The ARS receives results and creates the subsequent merged version as it receives responses from the registered Translator tools.  The status of each of the individual child messages as well as the status of the overall query are tracked in the status field at the root level of the message.  Typical statuses are:
Running - The ARS has sent this query to the corresponding ARA or has begun the merge and post-processing for a merged version, but it is not yet complete.
Done - There are no further changes to this message expected
Error - Either the Translator tool returned an error message or the ARS encountered an error in the processing of the results

The status of the parent message will be set to Done only after all the Translator tools have returned (or been timed out) and the merging and post processing has been complete.  While timing can vary by query, it is not uncommon for the process to take five minutes or more for all results to be received and processed.  

Checking TRAPI standards validation errors and warnings (Power users - developers UI option)

For a given PK, full compliance with TRAPI standards including a precise log of all errors and warnings are available for power users at  https://arax.ci.transltr.io/. 
Under the Queries tab>Import> <id>, paste the PK and the query response will load. For each message sent by an agent, the full log will be downloadable in the presence of an error or warning: Unfortunately, there is not currently an easily accessible web-interface for the tool that checks for compliance with the TRAPI standards, but I hope that will be available in the future. 

Clicking on the message ID link, you’ll get the full report available:

Checking TRAPI standards validation errors and warnings (Power users - developers CLI option)
You can create the same report using the CLI by using the open source code in this repository:https://github.com/NCATSTranslator/reasoner-validator. 

RUNNING QUERIES:
In order to run queries, they must be POSTed to the submission endpoint https://ars-prod.transltr.io/ars/api/submit 

This can be done using cURL or any number of other tools.  With cURL, the command looks like this:
curl -X POST  -H  "accept: application/json" -H  "Content-Type: application/json" -d @yourQueryFileHere.json

Save your desired query to a file, and then alter the highlighted portion of the above command to match your query filename.

You should receive a response from the server that looks something like this
{
  "model": "tr_ars.message",
  "pk": "9996fc1a-299d-4ac3-8814-404248bbde36",
  "fields": {
    "name": "",
    "code": 202,
    "status": "Running",
    "actor": 9,
    "timestamp": "2021-03-12T17:16:58.198Z",
    "data": {
      "message": {
        "query_graph": {
          "nodes": {
            "n0": {
              "id": "HGNC:11123",
              "category": "biolink:Gene"
            },
            "n1": {
              "category": "biolink:ChemicalSubstance"
            }
          },
          "edges": {
            "e01": {
              "subject": "n0",
              "object": "n1"
            }
          }
        }
      }
    },
    "url": null,
    "ref": null,
    "result_count": null,
    "result_stat": null,
    "retain": false,
    "merge_semaphore": false,
    "merged_version": null,
    "merged_versions_list": null

  }


The highlighted portion above is the PK for your query, the code by which it is identified and what you’ll use to view your results.  After receiving a message like the one above in response to your query, wait around five minutes to ensure that processing has completed, and then navigate to 
https://arax.ncats.io/
Click on <ID>, paste your PK into the provided text box, and then click “load”


This will take a few moments to load.  After this time, you should see a list of tools that responded to the ARS query and how many (if any) results that tool returned.  

To view those result sets individually, click the link for “MESSAGE ID” for that result set, and then click the Results tab on the left panel after it has loaded the result set (this will be noticeable when the -- in the box next to Results changes to the number of results in the set you’re interested in.

The results page should look something like this


Click any of the individual results to expand the result.  Within the expanded results, you should see the graph of that result (shown above with the connection between SPMSY and OCTREOTIDE) Within these graphs, you can click any of the nodes (shapes) or edges (arrows) to get more information about the entity or the connection found between them.  To return to the list of all result sets for your query, click on the “Query” at the top of the left panel and repeat the process of pulling up another set or results.  This interface can be somewhat finicky with regards to multiple queries.  So, if you find yourself having issues loading a new query or getting back to your result sets, it may be worth opening a new tab to https://arax.ncats.io and starting the process over from the pasting/loading of your PK.


To collect the results as JSON directly from the ARS, you can use 
https://ars-prod.transltr.io/ars/api/messages/YourPKHere?trace=y for the top-level PK sent back from the ARS in response to a query, and 
https://ars-prod.transltr.io/ars/api/messages/YourIndividualPKHere for the PKs associated with specific result sets from individual tools.  Please note that the trace=y flag is necessary for the top-level PK, but will obscure results for tool-specific PKs.











Additional resources
Mini-hackathon repository of jupyter notebooks used to query and return results from the ARS
A tree visualization of available node categories and their Biolink definitions is available to help constructing queries.
List of biolink types and identifier prefixes.


{
  "biolink:MolecularActivity": {
    "curie_prefix": {
      "GO": "11178",
      "REACT": "5588",
      "RHEA": "4169",
      "MetaCyc": "5344"
    }
  },
  "biolink:MolecularEntity": {
    "curie_prefix": {
      "PUBCHEM.COMPOUND": "96566919",
      "INCHIKEY": "96349470",
      "MESH": "274298",
      "CHEMBL.COMPOUND": "1889978",
      "CHEBI": "124930",
      "UNII": "82937",
      "KEGG.COMPOUND": "18744",
      "HMDB": "113979",
      "GTOPDB": "8895",
      "DRUGBANK": "10742",
      "UniProtKB": "564277",
      "NCBIGENE": "42373",
      "ENSEMBL": "39440",
      "HGNC": "42423",
      "HGNC.FAMILY": "1566",
      "PANTHER.FAMILY": "26255"
    }
  },
  "biolink:BiologicalProcess": {
    "curie_prefix": {
      "GO": "28893",
      "MetaCyc": "523",
      "REACT": "11",
      "SMPDB": "48703",
      "PANTHER.PATHWAY": "175"
    }
  },
  "biolink:OntologyClass": {
    "curie_prefix": {
      "NCBITaxon": "2313410",
      "MESH": "69895"
    }
  },
  "biolink:Cell": {
    "curie_prefix": {
      "CL": "2247",
      "UMLS": "13",
      "NCIT": "16",
      "MESH": "8",
      "UBERON": "16",
      "SNOMEDCT": "11"
    }
  },
  "biolink:ChemicalSubstance": {
    "curie_prefix": {
      "PUBCHEM.COMPOUND": "96566919",
      "INCHIKEY": "96349470",
      "MESH": "274298",
      "CHEMBL.COMPOUND": "1889978",
      "CHEBI": "124930",
      "UNII": "82937",
      "KEGG.COMPOUND": "18744",
      "HMDB": "113979",
      "GTOPDB": "8895",
      "DRUGBANK": "10742"
    }
  },
  "biolink:Pathway": {
    "curie_prefix": {
      "SMPDB": "48703",
      "PANTHER.PATHWAY": "175"
    }
  },
  "biolink:OrganismTaxon": {
    "curie_prefix": {
      "NCBITaxon": "2313410",
      "MESH": "69895"
    }
  },
  "biolink:GeneFamily": {
    "curie_prefix": {
      "HGNC.FAMILY": "1566",
      "PANTHER.FAMILY": "26255"
    }
  },
  "biolink:DiseaseOrPhenotypicFeature": {
    "curie_prefix": {
      "UMLS": "854729",
      "SNOMEDCT": "356714",
      "MONDO": "22251",
      "DOID": "8995",
      "EFO": "4948",
      "NCIT": "142418",
      "MESH": "279283",
      "MEDDRA": "25847",
      "OMIM": "8762",
      "ORPHANET": "9182",
      "HP": "15384",
      "ICD10": "12",
      "ICD9": "5",
      "MP": "29",
      "medgen": "3"
    }
  },
  "biolink:BiologicalEntity": {
    "curie_prefix": {
      "UBERON": "13470",
      "UMLS": "857676",
      "NCIT": "144912",
      "MESH": "554449",
      "GO": "44256",
      "MetaCyc": "5867",
      "REACT": "5599",
      "CL": "2248",
      "SNOMEDCT": "356726",
      "PUBCHEM.COMPOUND": "96566919",
      "INCHIKEY": "96349470",
      "CHEMBL.COMPOUND": "1889978",
      "CHEBI": "124930",
      "UNII": "82937",
      "KEGG.COMPOUND": "18744",
      "HMDB": "113979",
      "GTOPDB": "8895",
      "DRUGBANK": "10742",
      "MONDO": "22251",
      "DOID": "8995",
      "EFO": "4948",
      "MEDDRA": "25847",
      "OMIM": "8762",
      "ORPHANET": "9182",
      "HP": "15384",
      "ICD10": "12",
      "ICD9": "5",
      "MP": "29",
      "medgen": "3",
      "UniProtKB": "564277",
      "NCBIGENE": "42373",
      "ENSEMBL": "39440",
      "HGNC": "42423",
      "HGNC.FAMILY": "1566",
      "PANTHER.FAMILY": "26255",
      "RHEA": "4169",
      "SMPDB": "48703",
      "PANTHER.PATHWAY": "175"
    }
  },
  "biolink:OrganismalEntity": {
    "curie_prefix": {
      "UBERON": "13470",
      "UMLS": "2947",
      "NCIT": "2494",
      "MESH": "868",
      "CL": "2248",
      "SNOMEDCT": "12",
      "GO": "4185"
    }
  },
  "biolink:Entity": {
    "curie_prefix": {
      "UBERON": "13470",
      "UMLS": "857676",
      "NCIT": "144912",
      "MESH": "624344",
      "GO": "44256",
      "MetaCyc": "5867",
      "REACT": "5599",
      "CL": "2248",
      "SNOMEDCT": "356726",
      "PUBCHEM.COMPOUND": "96566919",
      "INCHIKEY": "96349470",
      "CHEMBL.COMPOUND": "1889978",
      "CHEBI": "124930",
      "UNII": "82937",
      "KEGG.COMPOUND": "18744",
      "HMDB": "113979",
      "GTOPDB": "8895",
      "DRUGBANK": "10742",
      "MONDO": "22251",
      "DOID": "8995",
      "EFO": "4948",
      "MEDDRA": "25847",
      "OMIM": "8762",
      "ORPHANET": "9182",
      "HP": "15384",
      "ICD10": "12",
      "ICD9": "5",
      "MP": "29",
      "medgen": "3",
      "UniProtKB": "564277",
      "NCBIGENE": "42373",
      "ENSEMBL": "39440",
      "HGNC": "42423",
      "HGNC.FAMILY": "1566",
      "PANTHER.FAMILY": "26255",
      "RHEA": "4169",
      "SMPDB": "48703",
      "PANTHER.PATHWAY": "175",
      "NCBITaxon": "2313410"
    }
  },
  "biolink:NamedThing": {
    "curie_prefix": {
      "UBERON": "13470",
      "UMLS": "857676",
      "NCIT": "144912",
      "MESH": "624344",
      "GO": "44256",
      "MetaCyc": "5867",
      "REACT": "5599",
      "CL": "2248",
      "SNOMEDCT": "356726",
      "PUBCHEM.COMPOUND": "96566919",
      "INCHIKEY": "96349470",
      "CHEMBL.COMPOUND": "1889978",
      "CHEBI": "124930",
      "UNII": "82937",
      "KEGG.COMPOUND": "18744",
      "HMDB": "113979",
      "GTOPDB": "8895",
      "DRUGBANK": "10742",
      "MONDO": "22251",
      "DOID": "8995",
      "EFO": "4948",
      "MEDDRA": "25847",
      "OMIM": "8762",
      "ORPHANET": "9182",
      "HP": "15384",
      "ICD10": "12",
      "ICD9": "5",
      "MP": "29",
      "medgen": "3",
      "UniProtKB": "564277",
      "NCBIGENE": "42373",
      "ENSEMBL": "39440",
      "HGNC": "42423",
      "HGNC.FAMILY": "1566",
      "PANTHER.FAMILY": "26255",
      "RHEA": "4169",
      "SMPDB": "48703",
      "PANTHER.PATHWAY": "175",
      "NCBITaxon": "2313410"
    }
  },
  "biolink:Gene": {
    "curie_prefix": {
      "UniProtKB": "564277",
      "NCBIGENE": "42373",
      "ENSEMBL": "39440",
      "HGNC": "42423"
    }
  },
  "biolink:CellularComponent": {
    "curie_prefix": {
      "GO": "4185",
      "MESH": "2",
      "UMLS": "3",
      "NCIT": "3",
      "UBERON": "3",
      "SNOMEDCT": "1",
      "CL": "1"
    }
  },
  "biolink:PhenotypicFeature": {
    "curie_prefix": {
      "NCIT": "123676",
      "UMLS": "746363",
      "SNOMEDCT": "280295",
      "MEDDRA": "14020",
      "MESH": "268595",
      "HP": "13627",
      "EFO": "3035",
      "MP": "27"
    }
  },
  "biolink:BiologicalProcessOrActivity": {
    "curie_prefix": {
      "GO": "40071",
      "MetaCyc": "5867",
      "REACT": "5599",
      "RHEA": "4169",
      "SMPDB": "48703",
      "PANTHER.PATHWAY": "175"
    }
  },
  "biolink:Disease": {
    "curie_prefix": {
      "UMLS": "108366",
      "SNOMEDCT": "76419",
      "MONDO": "22251",
      "DOID": "8995",
      "EFO": "1913",
      "NCIT": "18742",
      "MESH": "10688",
      "MEDDRA": "11827",
      "OMIM": "8762",
      "ORPHANET": "9182",
      "HP": "1757",
      "ICD10": "12",
      "ICD9": "5",
      "MP": "2",
      "medgen": "3"
    }
  },
  "biolink:AnatomicalEntity": {
    "curie_prefix": {
      "UBERON": "13470",
      "UMLS": "2947",
      "NCIT": "2494",
      "MESH": "868",
      "CL": "2248",
      "SNOMEDCT": "12",
      "GO": "4185"
    }
  },
  "biolink:GenomicEntity": {
    "curie_prefix": {
      "UniProtKB": "564277",
      "NCBIGENE": "42373",
      "ENSEMBL": "39440",
      "HGNC": "42423"
    }
  }
}

