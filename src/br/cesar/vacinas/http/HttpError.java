package br.cesar.vacinas.http;

public class HttpError extends RuntimeException {
    final int status;

    public HttpError(int status, String mensagem) {
        super(mensagem);
        this.status = status;
    }
}
