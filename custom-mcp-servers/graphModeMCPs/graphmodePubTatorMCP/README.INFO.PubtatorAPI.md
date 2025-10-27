This website uses cookies to provide necessary website functionality and improve your experience. Using this website, you agree to our web policies: [Web Policies](https://www.nlm.nih.gov/web_policies.html)

Agree

PubTator3

![NIH](assets/nih-logo-white.svg)

NLM

APITutorial

Application Programming Interface (API)

Pubtator3 provides APIs (Application Programming Interfaces) for users to export publications, find information on specific bioconcepts, and query relations of certain bioconcept pairs through programming. Please note PubTator3 APIs are different from those of its predecessor, if you’re a returning user.

**In order not to overload the PubTator3 server, we ask that users post no more than three requests per second.**

Export Annotations for a Set of Publications [Try Example](https://www.ncbi.nlm.nih.gov/research/pubtator3-api/publications/export/biocxml?pmids=123)

https://www.ncbi.nlm.nih.gov/research/pubtator3-api/publications/export/**format**?pmids=**pmids**

Users can program to export annotations for a set of publications in a given format through this API.

Three formats are supported: **pubtator**, **biocxml** or **biocjson**. Details of the formats can be found [here](https://www.ncbi.nlm.nih.gov/CBBresearch/Lu/Demo/tmTools/Format.html).

To use this API, please replace the **format** parameter with one of the three formats as mentioned above and submit a list of pmids separated by commas replacing the **pmids** parameter. Try out by clicking the **[Try Example](https://www.ncbi.nlm.nih.gov/research/pubtator3-api/publications/export/biocxml?pmids=123)** button.

If one wishes to obtain full-texts by pmids, we provide the **full** parameter to do it. Please be noted that full-texts are available in **biocxml** or **biocjson** formats, but not in **pubtator** format.

Example searched by: [https://www.ncbi.nlm.nih.gov/research/pubtator3-api/publications/export/biocxml?pmids=29355051&full=true](https://www.ncbi.nlm.nih.gov/research/pubtator3-api/publications/export/biocxml?pmids=29355051&full=true)

Users can also export full-texts by pmcids as in the following example:

[https://www.ncbi.nlm.nih.gov/research/pubtator3-api/publications/pmc\_export/biocxml?pmcids=PMC7696669,PMC8869656](https://www.ncbi.nlm.nih.gov/research/pubtator3-api/publications/pmc_export/biocxml?pmcids=PMC7696669,PMC8869656)

Find Entity ID [Try Example](https://www.ncbi.nlm.nih.gov/research/pubtator3-api/entity/autocomplete/?query=cancer&concept=disease&limit=10)

https://www.ncbi.nlm.nih.gov/research/pubtator3-api/entity/autocomplete/?query=**query**&concept=**bioconcept**(_OPTIONAL_)&limit=**number**(_OPTIONAL_)

This API can be used to find out the identifier for a specific bioconcept through free text query by replacing the **query** parameter with bioconcept in free text. Users can search for identifiers of a specific bioconcept type by passing a bioconcept type to the **concept** parameter (optional), and limit the number of returned identifiers through the **limit** parameter (optional). Try out by clicking the [Try Example](https://www.ncbi.nlm.nih.gov/research/pubtator3-api/entity/autocomplete/?query=cancer&concept=disease&limit=10) button.

Export Relevant Search Results [Try Example](https://www.ncbi.nlm.nih.gov/research/pubtator3-api/search/?text=@CHEMICAL_remdesivir)

https://www.ncbi.nlm.nih.gov/research/pubtator3-api/search/?text=**query**

User can query through this API for retrieving the relevant search results returned by PubTator3 given a query in the forms of free text, **entityId** (e.g., @CHEMICAL\_remdesivir) via **“Find Entity ID”**, or relations. Query of relations can be specified in the forms of relations between two entities (e.g., relations:ANY|@CHEMICAL\_Doxorubicin|@DISEASE\_Neoplasms) or relations between a entity and entities of a specific type (e.g., relations:ANY|@CHEMICAL\_Doxorubicin|DISEASE). Try out by clicking the [Try Example](https://www.ncbi.nlm.nih.gov/research/pubtator3-api/search/?text=@CHEMICAL_remdesivir) button.

Examples searched by:

[@CHEMICAL\_remdesivir](https://www.ncbi.nlm.nih.gov/research/pubtator3-api/search/?text=@CHEMICAL_remdesivir),

[@CHEMICAL\_Doxorubicin AND @DISEASE\_Neoplasms](https://www.ncbi.nlm.nih.gov/research/pubtator3-api/search/?text=@CHEMICAL_Doxorubicin AND @DISEASE_Neoplasms), or

[relations:ANY|@CHEMICAL\_Doxorubicin|@DISEASE\_Neoplasms](https://www.ncbi.nlm.nih.gov/research/pubtator3-api/search/?text=relations:ANY|@CHEMICAL_Doxorubicin|@DISEASE_Neoplasms), or

[relations:ANY|@CHEMICAL\_Doxorubicin|DISEASE](https://www.ncbi.nlm.nih.gov/research/pubtator3-api/search/?text=relations:ANY|@CHEMICAL_Doxorubicin|DISEASE)

User can acquire all query results **page by page** by specifying a number to the **page** parameter, e.g.,

[https://www.ncbi.nlm.nih.gov/research/pubtator3-api/search/?text=@CHEMICAL\_remdesivir&**page=1**](https://www.ncbi.nlm.nih.gov/research/pubtator3-api/search/?text=@CHEMICAL_remdesivir&page=1)

Find Related Entities [Try Example](https://www.ncbi.nlm.nih.gov/research/pubtator3-api/relations?e1=@GENE_JAK1&type=negative_correlate&e2=Chemical)

https://www.ncbi.nlm.nih.gov/research/pubtator3-api/relations?e1=**entityId**&type=**relation\_type**_(OPTIONAL)_&e2=**entity\_type**_(OPTIONAL)_

Passing a specific **entityId** (via **“Find Entity ID”**) to **e1**, **relation\_type** to **type** (optional), and **entity\_type** to **e2** (optional) to query related entities (of a specific entity type) in a specific relation type. Entity types include gene, disease, chemical, and variant. Available relation types include treat, cause, cotreat, convert, compare, interact, associate, positive\_correlate, negative\_correlate, prevent, inhibit, stimulate, and drug\_interact. Try out by clicking the [Try Example](https://www.ncbi.nlm.nih.gov/research/pubtator3-api/relations?e1=@GENE_JAK1&type=negative_correlate&e2=Chemical) button.

FTP for bulk download

PubTator provides bulk download of annotations in three popular formats (i.e., PubTator, BioC-XML, and BioC-JSON) from our ftp site: [https://ftp.ncbi.nlm.nih.gov/pub/lu/PubTator3](https://ftp.ncbi.nlm.nih.gov/pub/lu/PubTator3).

Process Raw Text

_Run our state-of-the-art NER tools on your own texts in BioC, pubtator or JSON formats._

First submit a request with your file to annotate :

curl -X POST https://www.ncbi.nlm.nih.gov/CBBresearch/Lu/Demo/RESTful/request.cgi -H "Content-Type: application/x-www-form-urlencoded" -d "text=\[ExampleText\]&bioconcept=\[Bioconcept\]"

A session number will be returned to you.

For example :

*   curl -X POST https://www.ncbi.nlm.nih.gov/CBBresearch/Lu/Demo/RESTful/request.cgi -H "Content-Type: application/x-www-form-urlencoded" -d "text=The ESR1 Mutations: From Bedside to Bench to Bedside.&bioconcept=Gene"

Retrieve the annotated file, by submitting the session ID for your job :

curl -X POST https://www.ncbi.nlm.nih.gov/CBBresearch/Lu/Demo/RESTful/retrieve.cgi -H "Content-Type: application/x-www-form-urlencoded" -d "id=\[SessionNumber\]"

**\[SessionNumber\]** is the number previoulsy returned by your submitted request.

When submitting this request, the system will return a warning message : **\[Warning\] : The Result is not ready"** with a 404 (Not Found) HTTP status code before the result is ready.

For example :

*   curl -X POST https://www.ncbi.nlm.nih.gov/CBBresearch/Lu/Demo/RESTful/retrieve.cgi -H "Content-Type: application/x-www-form-urlencoded" -d "id=538B76EE28D5E2D8FF13"

Click [here](https://www.ncbi.nlm.nih.gov/research/bionlp/APIs/format/) to see our format descriptions.

Download Code samples

[

Perl

](https://www.ncbi.nlm.nih.gov/CBBresearch/Lu/Demo/tmTools/download/ExampleCode.Perl.zip)

[

Python

](https://www.ncbi.nlm.nih.gov/CBBresearch/Lu/Demo/tmTools/download/ExampleCode.Python.zip)

[

Java

](https://www.ncbi.nlm.nih.gov/CBBresearch/Lu/Demo/tmTools/download/ExampleCode.Java.zip)

The information available on this website is freely accessible to all. More details about accessibility of this website are available at [NLM Accessibility](https://www.nlm.nih.gov/accessibility.html).

##### Disclaimer

This tool shows the results of research conducted in the [Computational Biology Branch](https://www.ncbi.nlm.nih.gov/research/), [NCBI/NLM](https://www.ncbi.nlm.nih.gov/home/about).

The information produced on this website is not intended for direct diagnostic use or medical decision-making without review and oversight by a clinical professional. Individuals should not change their health behavior solely on the basis of information produced on this website. NIH does not independently verify the validity or utility of the information produced by this tool. If you have questions about the information produced on this website, please see a health care professional.

More information about [NCBI/NLM's disclaimer policy](https://www.ncbi.nlm.nih.gov/home/about/policies.shtml) is available.

[NLM/NCBI BioNLP Research Group](https://www.ncbi.nlm.nih.gov/research/bionlp/)

[![U.S. Department of Health & Human Services](assets/dhhs-logo-white.svg)](https://www.hhs.gov/)[![National Institutes of Health](assets/nih-logo-white.svg)](https://www.nih.gov/)[![National Library of Medicine](assets/nlm-logo-letters-white.svg)](https://www.nlm.nih.gov/)[![USA.gov](assets/usagov-logo-white.svg)](https://www.usa.gov/)

##### Powered by

*   [AIONER](https://github.com/ncbi/AIONER/)
*   [BioREx](https://github.com/ncbi/BioREx/)
*   [TaggerOne](https://www.ncbi.nlm.nih.gov/research/bionlp/Tools/taggerone/)
*   [tmVar3](https://github.com/ncbi/tmVar3/)
*   [GNorm2](https://github.com/ncbi/GNorm2/)
*   [NLM-Chem](https://www.nature.com/articles/s41597-021-00875-1/)

##### Contact

*   [Zhiyong Lu, PhD](mailto:shubo.tian@nih.gov;chih-hsuan.wei@nih.gov;zhiyong.lu@nih.gov?subject=LitSearch feedback)
*   [Chih-Hsuan Wei, PhD](mailto:shubo.tian@nih.gov;chih-hsuan.wei@nih.gov;zhiyong.lu@nih.gov?subject=LitSearch feedback)
*   [Shubo Tian, PhD](mailto:shubo.tian@nih.gov;chih-hsuan.wei@nih.gov;zhiyong.lu@nih.gov?subject=LitSearch feedback)

National Center for Biotechnology Information, U.S. National Library of Medicine 8600 Rockville Pike, Bethesda MD, 20894 USA