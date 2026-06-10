from crewai import Crew, Process
from crewai.project import CrewBase, agent, crew

import agents as agent_factories
import tasks as task_factories


@CrewBase
class InvoiceOCRCrew:
    """
    Multi-agent crew for invoice OCR processing.
    Processes a single invoice through four sequential agents:
      OCR → Extraction → Validation → Storage
    """

    @agent
    def ocr_agent(self):
        return agent_factories.make_ocr_agent()

    @agent
    def extraction_agent(self):
        return agent_factories.make_extraction_agent()

    @agent
    def validation_agent(self):
        return agent_factories.make_validation_agent()

    @agent
    def storage_agent(self):
        return agent_factories.make_storage_agent()

    @crew
    def crew(self) -> Crew:
        # Build tasks explicitly so context chaining is unambiguous.
        # @CrewBase memoizes @agent calls — self.ocr_agent() always returns the same instance.
        t_ocr = task_factories.make_ocr_task(self.ocr_agent())
        t_ext = task_factories.make_extraction_task(self.extraction_agent(), t_ocr)
        t_val = task_factories.make_validation_task(self.validation_agent(), t_ext)
        t_sto = task_factories.make_storage_task(self.storage_agent(), t_val)

        return Crew(
            agents=[
                self.ocr_agent(),
                self.extraction_agent(),
                self.validation_agent(),
                self.storage_agent(),
            ],
            tasks=[t_ocr, t_ext, t_val, t_sto],
            process=Process.sequential,
            verbose=True,
        )
