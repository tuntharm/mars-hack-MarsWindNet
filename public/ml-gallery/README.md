# Results & modelling story

Public page: https://marswindnet.vercel.app/ml-gallery/index.html

Standalone HTML and CSS, served by Vite and Vercel. The exact route includes `index.html`.

The six chapters cover synthetic simulation, station inputs, preliminary XGBoost, preliminary LSTM, interpolated displays and next steps. `#s3` remains XGBoost; `#s5` remains spatial interpolation. Main navigation returns to `/#demo` or `/sensor/`.

Original XGBoost and simulation plots remain in `plots/`. LSTM images are byte-for-byte copies from `mars_lstm_predictions/` and `mars_lstm_interpolated_fields/`. Do not present interpolation as full-field inference or synthetic reference values as physical measurements. The original figures are preserved; captions clarify their meaning.

No training, model fetching or backend is performed by this page.
