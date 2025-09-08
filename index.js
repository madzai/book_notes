import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import * as dotenv from "dotenv";

const app = express();
const port = 3000;

dotenv.config();
const database = process.env.DATABASE;
const database_pw = process.env.DATABASE_PW;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: database,
  password: database_pw,
  port: 5432,
});
db.connect();
// body parser allows e.g. req.body.deleteItemId
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// get all books from the database
async function getBooks() {
  const result = await db.query("SELECT * FROM books ORDER BY date_read DESC, rating DESC");
  return result.rows;
}

app.get("/", async (req, res) => {
  const books = await getBooks();
  res.render("index.ejs", {books});
});

app.get("/add", async (req, res) => {
  res.render("add.ejs");
});

app.post("/add", async (req, res) => {
  const new_book_isbn = req.body.isbn;
  const new_book_title = req.body.title;
  const new_book_author = req.body.author;
  const new_book_date_read = req.body.date_read;
  const new_book_rating = req.body.rating;
  const new_book_summary = req.body.summary;
  const new_book_note = req.body.new_note;
   
  // insert new book into the database (if ISBN is not already in the database)
  const existingBook = await db.query("SELECT * FROM books WHERE isbn = $1", [new_book_isbn]);
  if (existingBook.rows.length > 0) {
    // ISBN already exists, redirect to the add page with an error message
    return res.render("add.ejs", { error: "Book with this ISBN already exists." });

  } else {
    // New book - insert all fields except notes
    db.query(
      "INSERT INTO books (isbn, title, author, date_read, rating, summary) VALUES ($1, $2, $3, $4, $5, $6)",
      [
        new_book_isbn,
        new_book_title,
        new_book_author,
        new_book_date_read,
        new_book_rating,
        new_book_summary
      ]
    );

    if (new_book_note) {
      // If a note is provided, append it to the notes array
      await db.query(
        "UPDATE books SET notes = array_append(notes, $1) WHERE isbn = $2",
        [new_book_note, new_book_isbn]
      );
    }
  }
  res.redirect("/");
});

app.get("/book/:id", async (req, res) => {
  const bookId = req.params.id;
  const result = await db.query("SELECT * FROM books WHERE id = $1", [bookId]);
  const book = result.rows[0];
  res.render("book.ejs", { book });
});

app.post("/delete/:id", async (req, res) => {
  const bookId = req.params.id;
  await db.query("DELETE FROM books WHERE id = $1", [bookId]);
  res.redirect("/");
});

app.get("/edit-details/:id", async (req, res) => {
  const bookId = req.params.id;
  const result = await db.query("SELECT * FROM books WHERE id = $1", [bookId]);
  const book = result.rows[0];
  res.render("edit_details.ejs", { book });
});

app.post("/edit-details/:id", async (req, res) => {
   const bookId = req.params.id;
   const new_isbn = req.body.isbn;
   const new_title = req.body.title;
   const new_author = req.body.author;
   const new_date_read = req.body.date_read;
   const new_rating = req.body.rating;

   await db.query(
     "UPDATE books SET isbn = $1, title = $2, author = $3, date_read = $4, rating = $5 WHERE id = $6",
     [new_isbn, new_title, new_author, new_date_read, new_rating, bookId]
   );

  res.redirect(`/book/${bookId}`);
});

app.get("/edit-summary/:id", async (req, res) => {
  const bookId = req.params.id;
  const result = await db.query("SELECT * FROM books WHERE id = $1", [bookId]);
  const book = result.rows[0];
  res.render("edit_summary.ejs", { book });
});

app.post("/edit-summary/:id", async (req, res) => {
  const bookId = req.params.id;
  const summary = req.body.summary;
  await db.query("UPDATE books SET summary = $1 WHERE id = $2", [summary, bookId]);
  res.redirect(`/book/${bookId}`);
});

app.get("/edit-notes/:id", async (req, res) => {
  const bookId = req.params.id;
  const result = await db.query("SELECT * FROM books WHERE id = $1", [bookId]);
  const book = result.rows[0];
  res.render("edit_notes.ejs", { book });
});

app.post("/add-note/:id", async (req, res) => {
  const bookId = req.params.id;
  const new_note = req.body.new_note;
  await db.query("UPDATE books SET notes = array_append(notes, $1) WHERE id = $2", [new_note, bookId]);
  res.redirect(`/edit-notes/${bookId}`);
});

app.post("/del-note/:id", async (req, res) => {
  const bookId = req.params.id;
  const del_note_id = req.body.del_note;
  await db.query("UPDATE books SET notes = array_remove(notes, notes[$1]) WHERE id = $2",[del_note_id, bookId]);
  res.redirect(`/edit-notes/${bookId}`);
});

app.post("/update-note/:id", async (req, res) => {
  const bookId = req.params.id;
  const update_note_id = req.body.update_note_id;
  const updated_note = req.body.updated_note;
  // Update the note if the new value is not empty, remove it if empty
  if (updated_note.length > 0) {
    await db.query("UPDATE books SET notes[$1] =  $2 WHERE id = $3", [update_note_id, updated_note, bookId]);
  // remove the note if empty
  } else {
    await db.query("UPDATE books SET notes = array_remove(notes, notes[$1]) WHERE id = $2", [update_note_id, bookId]);
  }
  res.redirect(`/edit-notes/${bookId}`);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});