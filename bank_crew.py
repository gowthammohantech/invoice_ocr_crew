from crewai import Crew, Process
from crewai.project import CrewBase, agent, crew

import bank_agents as agent_factories
import bank_tasks as task_factories


@CrewBase
class BankReconciliationCrew:
    """
    Multi-agent crew for bank reconciliation statement processing.
    Processes a single bank statement through three sequential agents:
      OCR → Extraction → Validation
    Storage is handled directly in Python by _run_bank_crew() after kickoff returns.
    """

    @agent
    def ocr_agent(self):
        return agent_factories.make_bank_ocr_agent()

    @agent
    def extraction_agent(self):
        return agent_factories.make_bank_extraction_agent()

    @agent
    def validation_agent(self):
        return agent_factories.make_bank_validation_agent()

    @crew
    def crew(self) -> Crew:
        t_ocr = task_factories.make_bank_ocr_task(self.ocr_agent())
        t_ext = task_factories.make_bank_extraction_task(self.extraction_agent(), t_ocr)
        t_val = task_factories.make_bank_validation_task(self.validation_agent(), t_ext)

        return Crew(
            agents=[
                self.ocr_agent(),
                self.extraction_agent(),
                self.validation_agent(),
            ],
            tasks=[t_ocr, t_ext, t_val],
            process=Process.sequential,
            verbose=True,
        )
