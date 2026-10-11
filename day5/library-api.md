# Library Books API

Base path: `/books`

## Endpoints

- **List books** — `GET /books` — Returns the collection of books. Success: `200 OK`.
- **Get one book** — `GET /books/{bookId}` — Returns the book with the given ID. Success: `200 OK`.
- **Create a book** — `POST /books` — Adds a book to the collection. Example request body:

  ```json
  {
    "title": "The Left Hand of Darkness",
    "author": "Ursula K. Le Guin",
    "publishedYear": 1969
  }
  ```

  Success: `201 Created`.
- **Update a book** — `PUT /books/{bookId}` — Replaces the book with the given ID. Example request body:

  ```json
  {
    "title": "The Left Hand of Darkness",
    "author": "Ursula K. Le Guin",
    "publishedYear": 1969
  }
  ```

  Success: `200 OK`.
- **Delete a book** — `DELETE /books/{bookId}` — Removes the book with the given ID. Success: `204 No Content`.
- **List books by author** — `GET /books?author=Ursula%20K.%20Le%20Guin` — Returns books matching the `author` query parameter. Success: `200 OK`.

## Error Responses

- **`400 Bad Request`** — The request is invalid, for example a create request is missing the required `title` field.
- **`404 Not Found`** — The requested book ID does not exist, for example `GET /books/9999` when there is no book with that ID.