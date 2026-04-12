from abc import ABC, abstractmethod

class BaseProvider(ABC):
    """
    LLM hornitzailearen oinarrizko interfazea.

    Metodoak:
        generate_response(prompt: str) -> str: Prompt bat bidali eta erantzuna jaso.
        is_available() -> bool: Hornitzailea erabilgarri dagoen egiaztatu.
    """

    @abstractmethod
    async def generate_response(self, prompt: str, max_tokens: int) -> str:
        """
        Prompt bat bidali eta LLM-ren erantzuna jaso.

        Args:
            prompt (str): Bidaltzeko prompta.
            max_tokens (int): Gehienezko token kopurua.

        Returns:
            str: LLM-ren erantzuna.
        """
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """
        Hornitzailea erabilgarri dagoen egiaztatu.

        Returns:
            bool: True erabilgarri badago, bestela False.
        """
        pass