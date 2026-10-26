package app.zelvaryn.signer;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.text.TextUtils;
import android.util.Log;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {

    private static final String TAG = "Zelvaryn";
    private static final String PREFS = "zelvaryn";
    private static final String KEY_URL = "studio_url";
    private static final String KEY_ALIAS = "keystore_alias";
    private static final String DEFAULT_URL = "https://zelvaryn.studio";
    private static final int REQ_PICK = 71;
    private static final long MAX_UPLOAD = 96L * 1024L * 1024L;

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final List<String> keyIds = new ArrayList<>();
    private final List<String> keyLabels = new ArrayList<>();

    private EditText etStudio;
    private EditText etPassphrase;
    private TextView tvLinkStatus;
    private TextView tvKeyInfo;
    private TextView tvFileName;
    private TextView tvStatus;
    private TextView tvLog;
    private ProgressBar progress;
    private Button btnSign;
    private Button btnRefreshKeys;
    private Button btnTestLink;
    private Spinner spinnerKeys;
    private SharedPreferences prefs;

    private Uri pickedUri;
    private String pickedName;
    private long pickedSize;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        etStudio = findViewById(R.id.etStudio);
        etPassphrase = findViewById(R.id.etPassphrase);
        tvLinkStatus = findViewById(R.id.tvLinkStatus);
        tvKeyInfo = findViewById(R.id.tvKeyInfo);
        tvFileName = findViewById(R.id.tvFileName);
        tvStatus = findViewById(R.id.tvStatus);
        tvLog = findViewById(R.id.tvLog);
        progress = findViewById(R.id.progress);
        btnSign = findViewById(R.id.btnSign);
        btnRefreshKeys = findViewById(R.id.btnRefreshKeys);
        btnTestLink = findViewById(R.id.btnTestLink);
        spinnerKeys = findViewById(R.id.spinnerKeys);

        etStudio.setText(prefs.getString(KEY_URL, DEFAULT_URL));
        bindFingerprint();
        handlePairing(getIntent());

        findViewById(R.id.btnSaveStudio).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                saveStudio(true);
            }
        });

        btnTestLink.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                testLink();
            }
        });

        btnRefreshKeys.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                loadKeystores();
            }
        });

        findViewById(R.id.btnChooseFile).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                pickFile();
            }
        });

        btnSign.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                startSigning();
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handlePairing(intent);
    }

    private void handlePairing(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri data = intent.getData();
        if (!"zelvaryn".equals(data.getScheme())) return;
        String url = data.getQueryParameter("url");
        if (!TextUtils.isEmpty(url)) {
            etStudio.setText(url);
            saveStudio(false);
            log("› paired with studio " + url);
        }
    }

    private void saveStudio(boolean announce) {
        String url = etStudio.getText().toString().trim();
        if (TextUtils.isEmpty(url)) {
            toast("Add your studio URL first");
            return;
        }
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://" + url;
            etStudio.setText(url);
        }
        prefs.edit().putString(KEY_URL, trimSlash(url)).apply();
        if (announce) {
            tvLinkStatus.setText("Saved " + trimSlash(url) + " · run TEST LINK to verify.");
            log("› studio endpoint saved");
        }
    }

    private void testLink() {
        saveStudio(false);
        final String base = studio();
        setBusy(true, "Contacting signing engine…");
        log("› GET " + base + "/api/health");
        io.execute(new Runnable() {
            @Override public void run() {
                HttpURLConnection conn = null;
                try {
                    conn = open(base + "/api/health", "GET");
                    int code = conn.getResponseCode();
                    String body = readBody(conn);
                    if (code / 100 != 2) throw new IOException("HTTP " + code + " · " + body);
                    JSONObject json = new JSONObject(body);
                    final String version = json.optString("version", "1.0.0");
                    final String engine = json.optString("engine", "unknown");
                    ui.post(new Runnable() {
                        @Override public void run() {
                            tvLinkStatus.setText("Engine online · core " + engine + " · v" + version);
                            setBusy(false, "Studio linked");
                            log("✓ engine online · core " + engine);
                        }
                    });
                } catch (final Exception e) {
                    fail("Cannot reach studio", e);
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }
        });
    }

    private void loadKeystores() {
        saveStudio(false);
        final String base = studio();
        setBusy(true, "Reading keystore inventory…");
        io.execute(new Runnable() {
            @Override public void run() {
                HttpURLConnection conn = null;
                try {
                    conn = open(base + "/api/keystores", "GET");
                    int code = conn.getResponseCode();
                    String body = readBody(conn);
                    if (code / 100 != 2) throw new IOException("HTTP " + code);
                    JSONObject json = new JSONObject(body);
                    JSONArray arr = json.optJSONArray("keystores");
                    keyIds.clear();
                    keyLabels.clear();
                    if (arr != null) {
                        for (int i = 0; i < arr.length(); i++) {
                            JSONObject k = arr.getJSONObject(i);
                            String alias = k.optString("alias", "key-" + i);
                            String cn = k.optString("commonName", "Zelvaryn");
                            keyIds.add(k.optString("id"));
                            keyLabels.add(alias + " · " + cn);
                        }
                    }
                    if (keyIds.isEmpty()) keyLabels.add("No keystores found — create one in the studio");
                    ui.post(new Runnable() {
                        @Override public void run() {
                            ArrayAdapter<String> adapter = new ArrayAdapter<>(MainActivity.this,
                                    android.R.layout.simple_spinner_item, keyLabels);
                            adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
                            spinnerKeys.setAdapter(adapter);
                            String saved = prefs.getString(KEY_ALIAS, "");
                            for (int i = 0; i < keyLabels.size(); i++) {
                                if (keyLabels.get(i).startsWith(saved) && !saved.isEmpty()) {
                                    spinnerKeys.setSelection(i);
                                }
                            }
                            tvKeyInfo.setText(keyIds.size() + " keystore(s) loaded from the studio.");
                            setBusy(false, "Keystores ready");
                            log("✓ " + keyIds.size() + " keystore(s) available");
                        }
                    });
                } catch (final Exception e) {
                    fail("Keystore lookup failed", e);
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }
        });
    }

    private void pickFile() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                "application/vnd.android.package-archive",
                "application/zip",
                "application/octet-stream",
                "*/*"
        });
        try {
            startActivityForResult(intent, REQ_PICK);
        } catch (Exception e) {
            toast("No file picker available");
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_PICK || resultCode != RESULT_OK || data == null || data.getData() == null) {
            return;
        }
        pickedUri = data.getData();
        pickedName = "artifact.apk";
        pickedSize = 0L;
        try {
            getContentResolver().takePersistableUriPermission(pickedUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception ignored) {
        }
        Cursor cursor = null;
        try {
            cursor = getContentResolver().query(pickedUri, null, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                int nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                int sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (nameIdx >= 0) pickedName = cursor.getString(nameIdx);
                if (sizeIdx >= 0) pickedSize = cursor.getLong(sizeIdx);
            }
        } catch (Exception e) {
            Log.w(TAG, "metadata lookup failed", e);
        } finally {
            if (cursor != null) cursor.close();
        }
        tvFileName.setText(pickedName + "  ·  " + human(pickedSize));
        log("› artifact staged: " + pickedName);
        setStatus("Artifact ready · " + human(pickedSize), false);
    }

    private void startSigning() {
        saveStudio(false);
        if (pickedUri == null) {
            toast("Choose an artifact first");
            return;
        }
        int index = spinnerKeys.getSelectedItemPosition();
        if (index < 0 || index >= keyIds.size()) {
            toast("Load keystores, then choose a signing key");
            return;
        }
        final String keystoreId = keyIds.get(index);
        final String passphrase = etPassphrase.getText().toString();
        final String base = studio();
        if (passphrase.isEmpty()) {
            toast("Enter the keystore passphrase");
            return;
        }

        setBusy(true, "Signing in progress…");
        tvLog.setText("");
        log("› zelvaryn signing session " + stamp());
        log("› key " + keyLabels.get(index));
        io.execute(new Runnable() {
            @Override public void run() {
                HttpURLConnection conn = null;
                try {
                    byte[] artifact = readAll(pickedUri);
                    if (artifact.length == 0) throw new IOException("Artifact is empty");
                    if (artifact.length > MAX_UPLOAD) throw new IOException("Artifact exceeds the 96 MB mobile upload limit");
                    log("› artifact read · " + human(artifact.length));
                    log("› POST " + base + "/api/sign");

                    Map<String, String> fields = new LinkedHashMap<>();
                    fields.put("keystoreId", keystoreId);
                    fields.put("passphrase", passphrase);
                    String boundary = "----zelvaryn" + System.currentTimeMillis();
                    byte[] payload = multipart(boundary, fields, "file", pickedName, artifact);

                    conn = open(base + "/api/sign", "POST");
                    conn.setDoOutput(true);
                    conn.setFixedLengthStreamingMode(payload.length);
                    conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
                    OutputStream os = conn.getOutputStream();
                    os.write(payload);
                    os.flush();
                    os.close();

                    int code = conn.getResponseCode();
                    String body = readBody(conn);
                    if (code / 100 != 2) {
                        String message = "HTTP " + code;
                        try {
                            message = new JSONObject(body).optString("error", message);
                        } catch (Exception ignored) {
                        }
                        throw new IOException(message);
                    }
                    JSONObject json = new JSONObject(body);
                    JSONObject job = json.optJSONObject("job");
                    if (job == null) throw new IOException("Malformed signing response");
                    String downloadUrl = json.optString("downloadUrl", "/api/jobs/" + job.optString("id") + "/download");
                    String outputName = job.optString("outputName", "signed.apk");
                    String sha256 = job.optString("sha256", "");
                    JSONArray logs = job.optJSONArray("logs");
                    if (logs != null) {
                        for (int i = 0; i < logs.length(); i++) log("  " + logs.optString(i));
                    }
                    log("› fetching signed artifact");
                    byte[] signed = download(base, downloadUrl);
                    String saved = save(signed, outputName);
                    log("✓ signed · " + human(signed.length) + " · sha256 " + shortSha(sha256));
                    log("✓ saved to " + saved);
                    final String message = saved;
                    final String digest = sha256;
                    final long size = signed.length;
                    ui.post(new Runnable() {
                        @Override public void run() {
                            setBusy(false, "SIGNED · " + outputName);
                            showSuccess(message, digest, size);
                        }
                    });
                } catch (final Exception e) {
                    fail("Signing failed", e);
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }
        });
    }

    private void showSuccess(String path, String digest, long size) {
        new AlertDialog.Builder(this)
                .setTitle("APK signed")
                .setMessage("Artifact: " + path + "\nSize: " + human(size) + "\nSHA-256: " + digest
                        + "\n\nSchemes: v1 JAR + v2 APK Signature Scheme.")
                .setPositiveButton("Done", null)
                .show();
    }

    private void bindFingerprint() {
        TextView tv = findViewById(R.id.tvFingerprint);
        String fp = "unknown";
        try {
            Signature[] sigs = getPackageManager()
                    .getPackageInfo(getPackageName(), PackageManager.GET_SIGNATURES).signatures;
            if (sigs != null && sigs.length > 0) {
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                fp = hex(md.digest(sigs[0].toByteArray()));
            }
        } catch (Exception e) {
            Log.w(TAG, "fingerprint failed", e);
        }
        tv.setText("APP CERT SHA-256\n" + fp + "\n\nZELVARYN 1.0.0 · ENGINE APK-SIG V2 · ANDROID " + Build.VERSION.RELEASE);
    }

    // ---------- plumbing ----------

    private String studio() {
        return trimSlash(etStudio.getText().toString().trim());
    }

    private static String trimSlash(String s) {
        String v = s.trim();
        while (v.endsWith("/")) v = v.substring(0, v.length() - 1);
        if (!v.startsWith("http://") && !v.startsWith("https://")) v = "https://" + v;
        return v;
    }

    private static HttpURLConnection open(String url, String method) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setRequestMethod(method);
        c.setConnectTimeout(15000);
        c.setReadTimeout(240000);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("Accept", "application/json");
        c.setRequestProperty("User-Agent", "Zelvaryn-Android/1.0");
        return c;
    }

    private static String readBody(HttpURLConnection c) throws IOException {
        InputStream is = null;
        try {
            int code = c.getResponseCode();
            is = code >= 400 ? c.getErrorStream() : c.getInputStream();
            if (is == null) return "";
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        } finally {
            if (is != null) try { is.close(); } catch (IOException ignored) {}
        }
    }

    private byte[] readAll(Uri uri) throws IOException {
        ContentResolver resolver = getContentResolver();
        InputStream is = resolver.openInputStream(uri);
        if (is == null) throw new IOException("Cannot open artifact");
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = is.read(buf)) > 0) {
                out.write(buf, 0, n);
                if (out.size() > MAX_UPLOAD) throw new IOException("Artifact exceeds the mobile upload limit");
            }
            return out.toByteArray();
        } finally {
            try { is.close(); } catch (IOException ignored) {}
        }
    }

    private static byte[] multipart(String boundary, Map<String, String> fields,
                                    String fileField, String fileName, byte[] file) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (Map.Entry<String, String> e : fields.entrySet()) {
            out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
            out.write(("Content-Disposition: form-data; name=\"" + e.getKey() + "\"\r\n\r\n")
                    .getBytes(StandardCharsets.UTF_8));
            out.write(e.getValue().getBytes(StandardCharsets.UTF_8));
            out.write("\r\n".getBytes(StandardCharsets.UTF_8));
        }
        out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(("Content-Disposition: form-data; name=\"" + fileField + "\"; filename=\""
                + fileName.replace("\"", "") + "\"\r\n").getBytes(StandardCharsets.UTF_8));
        out.write("Content-Type: application/octet-stream\r\n\r\n".getBytes(StandardCharsets.UTF_8));
        out.write(file);
        out.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        return out.toByteArray();
    }

    private static byte[] download(String base, String downloadUrl) throws IOException {
        String url = downloadUrl.startsWith("http") ? downloadUrl : base + downloadUrl;
        HttpURLConnection c = open(url, "GET");
        try {
            int code = c.getResponseCode();
            if (code / 100 != 2) throw new IOException("Download failed · HTTP " + code);
            InputStream is = c.getInputStream();
            try {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[16384];
                int n;
                while ((n = is.read(buf)) > 0) out.write(buf, 0, n);
                return out.toByteArray();
            } finally {
                try { is.close(); } catch (IOException ignored) {}
            }
        } finally {
            c.disconnect();
        }
    }

    private String save(byte[] data, String name) throws IOException {
        String safe = name == null || name.isEmpty() ? "zelvaryn-signed.apk" : name.replace("/", "-");
        if (!safe.toLowerCase(Locale.US).endsWith(".apk")) safe = safe + ".apk";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, safe);
            values.put(MediaStore.MediaColumns.MIME_TYPE, "application/vnd.android.package-archive");
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Zelvaryn");
            Uri target = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (target == null) throw new IOException("Could not create download entry");
            OutputStream os = getContentResolver().openOutputStream(target);
            if (os == null) throw new IOException("Could not open download stream");
            try {
                os.write(data);
                os.flush();
            } finally {
                os.close();
            }
            return "Downloads/Zelvaryn/" + safe;
        }
        File dir = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "Zelvaryn");
        if (!dir.exists() && !dir.mkdirs()) throw new IOException("Could not create output folder");
        File out = new File(dir, safe);
        FileOutputStream fos = new FileOutputStream(out);
        try {
            fos.write(data);
            fos.flush();
        } finally {
            fos.close();
        }
        return out.getAbsolutePath();
    }

    private void setBusy(final boolean busy, final String status) {
        ui.post(new Runnable() {
            @Override public void run() {
                btnSign.setEnabled(!busy);
                btnRefreshKeys.setEnabled(!busy);
                btnTestLink.setEnabled(!busy);
                progress.setVisibility(busy ? View.VISIBLE : View.GONE);
                setStatus(status, false);
            }
        });
    }

    private void setStatus(String text, boolean error) {
        tvStatus.setText(text);
        tvStatus.setTextColor(error ? 0xFFFF6B81 : 0xFFA855F7);
    }

    private void log(final String line) {
        ui.post(new Runnable() {
            @Override public void run() {
                tvLog.append(line + "\n");
            }
        });
    }

    private void fail(final String prefix, final Exception e) {
        Log.e(TAG, prefix, e);
        ui.post(new Runnable() {
            @Override public void run() {
                progress.setVisibility(View.GONE);
                btnSign.setEnabled(true);
                btnRefreshKeys.setEnabled(true);
                btnTestLink.setEnabled(true);
                setStatus("FAILED · " + safeMessage(e), true);
                log("✗ " + prefix + ": " + safeMessage(e));
            }
        });
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    private static String safeMessage(Exception e) {
        String m = e.getMessage();
        if (m == null || m.isEmpty()) m = e.getClass().getSimpleName();
        return m.length() > 220 ? m.substring(0, 220) + "…" : m;
    }

    private static String human(long bytes) {
        if (bytes <= 0) return "unknown size";
        if (bytes < 1024) return bytes + " B";
        double kb = bytes / 1024.0;
        if (kb < 1024) return String.format(Locale.US, "%.1f KB", kb);
        return String.format(Locale.US, "%.2f MB", kb / 1024.0);
    }

    private static String shortSha(String sha) {
        if (sha == null || sha.length() < 16) return sha;
        return sha.substring(0, 16) + "…";
    }

    private static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format(Locale.US, "%02X", b));
        return sb.toString();
    }

    private static String stamp() {
        return new java.text.SimpleDateFormat("HH:mm:ss", Locale.US).format(new java.util.Date());
    }
}
