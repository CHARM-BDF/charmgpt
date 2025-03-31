# Node Normalizer - from Translator

## CURIE that are considered equivalent or close enough that they should only return one node

URL to results from a Translator CURIE:

Example of multi CURIE for 'NCBIGene:1859' and 'NCIT:C34373':

curl -X 'GET' \
  'https://nodenorm.ci.transltr.io/1.5/get_normalized_nodes?curie=NCBIGene%3A1859&curie=NCIT%3AC34373&conflate=true&drug_chemical_conflate=false&description=true&individual_types=true' \
  -H 'accept: application/json'


Code 200 return the following data type 
{
  "NCBIGene:1859": {
    "id": {
      "identifier": "NCBIGene:1859",
      "label": "DYRK1A",
      "description": "A dual specificity tyrosine-phosphorylation-regulated kinase 1A that is encoded in the genome of human."
    },
    "equivalent_identifiers": [
      {
        "identifier": "NCBIGene:1859",
        "label": "DYRK1A",
        "type": "biolink:Gene"
      },
      {
        "identifier": "ENSEMBL:ENSG00000157540",
        "label": "DYRK1A (Hsap)",
        "type": "biolink:Gene"
      },
      {
        "identifier": "HGNC:3091",
        "label": "DYRK1A",
        "type": "biolink:Gene"
      },
      {
        "identifier": "OMIM:600855",
        "type": "biolink:Gene"
      },
      {
        "identifier": "UMLS:C1414204",
        "label": "DYRK1A gene",
        "type": "biolink:Gene"
      },
      {
        "identifier": "UniProtKB:A0A2R8Y6I6",
        "label": "A0A2R8Y6I6_HUMAN Dual specificity tyrosine-phosphorylation-regulated kinase 1A (trembl)",
        "type": "biolink:Protein"
      },
      {
        "identifier": "ENSEMBL:ENSP00000495571",
        "type": "biolink:Protein"
      },
      {
        "identifier": "ENSEMBL:ENSP00000495571.1",
        "type": "biolink:Protein"
      },
      {
        "identifier": "UniProtKB:Q13627",
        "label": "DYR1A_HUMAN Dual specificity tyrosine-phosphorylation-regulated kinase 1A (sprot)",
        "type": "biolink:Protein"
      },
      {
        "identifier": "PR:Q13627",
        "label": "dual specificity tyrosine-phosphorylation-regulated kinase 1A (human)",
        "description": "A dual specificity tyrosine-phosphorylation-regulated kinase 1A that is encoded in the genome of human.",
        "type": "biolink:Protein"
      },
      {
        "identifier": "UMLS:C1453762",
        "label": "DYRK1A protein, human",
        "type": "biolink:Protein"
      }
    ],
    "type": [
      "biolink:Gene",
      "biolink:GeneOrGeneProduct",
      "biolink:GenomicEntity",
      "biolink:ChemicalEntityOrGeneOrGeneProduct",
      "biolink:PhysicalEssence",
      "biolink:OntologyClass",
      "biolink:BiologicalEntity",
      "biolink:ThingWithTaxon",
      "biolink:NamedThing",
      "biolink:PhysicalEssenceOrOccurrent",
      "biolink:MacromolecularMachineMixin",
      "biolink:Protein",
      "biolink:GeneProductMixin",
      "biolink:Polypeptide",
      "biolink:ChemicalEntityOrProteinOrPolypeptide"
    ],
    "information_content": 100
  },
  "NCIT:C34373": {
    "id": {
      "identifier": "MONDO:0004976",
      "label": "amyotrophic lateral sclerosis",
      "description": "Amyotrophic lateral sclerosis (ALS) is a neurodegenerative disease characterized by progressive muscular paralysis reflecting degeneration of motor neurons in the primary motor cortex, corticospinal tracts, brainstem and spinal cord."
    },
    "equivalent_identifiers": [
      {
        "identifier": "MONDO:0004976",
        "label": "amyotrophic lateral sclerosis",
        "description": "Amyotrophic lateral sclerosis (ALS) is a neurodegenerative disease characterized by progressive muscular paralysis reflecting degeneration of motor neurons in the primary motor cortex, corticospinal tracts, brainstem and spinal cord.",
        "type": "biolink:Disease"
      },
      {
        "identifier": "DOID:332",
        "label": "amyotrophic lateral sclerosis",
        "type": "biolink:Disease"
      },
      {
        "identifier": "orphanet:803",
        "type": "biolink:Disease"
      },
      {
        "identifier": "UMLS:C0002736",
        "label": "Amyotrophic Lateral Sclerosis",
        "type": "biolink:Disease"
      },
      {
        "identifier": "MESH:D000690",
        "label": "Amyotrophic Lateral Sclerosis",
        "type": "biolink:Disease"
      },
      {
        "identifier": "MEDDRA:10002026",
        "type": "biolink:Disease"
      },
      {
        "identifier": "MEDDRA:10052889",
        "type": "biolink:Disease"
      },
      {
        "identifier": "NCIT:C34373",
        "label": "Amyotrophic Lateral Sclerosis",
        "description": "A neurodegenerative disorder characterized by progressive degeneration of the motor neurons of the central nervous system. It results in weakness and atrophy of the muscles which leads to an inability to initiate and control voluntary movements.",
        "type": "biolink:Disease"
      },
      {
        "identifier": "SNOMEDCT:86044005",
        "type": "biolink:Disease"
      },
      {
        "identifier": "medgen:274",
        "type": "biolink:Disease"
      },
      {
        "identifier": "ICD10:G12.21",
        "type": "biolink:Disease"
      },
      {
        "identifier": "ICD9:335.20",
        "type": "biolink:Disease"
      },
      {
        "identifier": "KEGG.DISEASE:05014",
        "type": "biolink:Disease"
      },
      {
        "identifier": "HP:0007354",
        "label": "Amyotrophic lateral sclerosis",
        "type": "biolink:Disease"
      }
    ],
    "type": [
      "biolink:Disease",
      "biolink:DiseaseOrPhenotypicFeature",
      "biolink:BiologicalEntity",
      "biolink:ThingWithTaxon",
      "biolink:NamedThing"
    ],
    "information_content": 74.9
  }
}
