package br.cesar.vacinas.http;

/** Erro que vira resposta HTTP {"erro": "..."} com o status indicado (400, 404, 409). */
public class HttpError extends RuntimeException {
    final int status;

    public HttpError(int status, String mensagem) {
        super(mensagem);
        this.status = status;
    }
}
