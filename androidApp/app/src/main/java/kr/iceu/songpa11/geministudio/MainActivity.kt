package kr.iceu.songpa11.geministudio

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.view.View
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import kr.iceu.songpa11.geministudio.databinding.ActivityMainBinding
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    // Production Cloud Run URL & Local Emulator URL
    private val defaultProdUrl = "https://gemini-studio-976675812314.asia-northeast3.run.app"
    private val defaultEmulatorUrl = "http://10.0.2.2:3000"

    private var currentUrl: String = defaultProdUrl

    // File Chooser for Multimodal Image Upload
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var cameraImageUri: Uri? = null

    // Activity Result Launcher for File Upload (Camera & Gallery)
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (filePathCallback == null) return@registerForActivityResult

        var results: Array<Uri>? = null

        if (result.resultCode == RESULT_OK) {
            val intent = result.data
            if (intent != null && intent.data != null) {
                // Chosen from Gallery / Files
                results = arrayOf(intent.data!!)
            } else if (intent?.clipData != null) {
                // Multiple images chosen
                val clipData = intent.clipData!!
                val uriList = ArrayList<Uri>()
                for (i in 0 until clipData.itemCount) {
                    uriList.add(clipData.getItemAt(i).uri)
                }
                results = uriList.toTypedArray()
            } else if (cameraImageUri != null) {
                // Photo captured from Camera
                results = arrayOf(cameraImageUri!!)
            }
        }

        filePathCallback?.onReceiveValue(results)
        filePathCallback = null
        cameraImageUri = null
    }

    // Permission Request Launcher for Microphone / Camera
    private var pendingPermissionRequest: PermissionRequest? = null
    private val runtimePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val recordAudioGranted = permissions[Manifest.permission.RECORD_AUDIO] == true
        val cameraGranted = permissions[Manifest.permission.CAMERA] == true

        if (pendingPermissionRequest != null) {
            val requestedResources = ArrayList<String>()
            if (recordAudioGranted) {
                requestedResources.add(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
            }
            if (cameraGranted) {
                requestedResources.add(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
            }

            if (requestedResources.isNotEmpty()) {
                pendingPermissionRequest?.grant(requestedResources.toTypedArray())
            } else {
                pendingPermissionRequest?.deny()
            }
            pendingPermissionRequest = null
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Load saved server preference or use default Cloud Run
        val prefs = getSharedPreferences("gemini_app_prefs", Context.MODE_PRIVATE)
        currentUrl = prefs.getString("server_url", defaultProdUrl) ?: defaultProdUrl

        setupSystemBars()
        setupWebView()
        setupSwipeRefresh()
        setupBackNavigation()
        setupOfflineRetry()

        // Load Initial URL
        loadServerUrl(currentUrl)
    }

    private fun setupSystemBars() {
        window.statusBarColor = ContextCompat.getColor(this, R.color.bg_main)
        window.navigationBarColor = ContextCompat.getColor(this, R.color.bg_main)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val webView = binding.webView
        val settings = webView.settings

        // Enable Core Modern Web Features
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.mediaPlaybackRequiresUserGesture = false

        // Cache & Performance
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true

        // Mixed Content allowed for local emulator testing
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }

        // Custom User Agent to identify native wrapper
        val defaultUserAgent = settings.userAgentString
        settings.userAgentString = "$defaultUserAgent GeminiStudioAndroid/1.0.0"

        // Setup WebViewClient
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                binding.progressBar.visibility = View.VISIBLE
                binding.offlineContainer.visibility = View.GONE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                binding.progressBar.visibility = View.GONE
                binding.swipeRefreshLayout.isRefreshing = false
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    showOfflineError()
                }
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString() ?: return false

                // Keep app host links in WebView
                if (url.startsWith("https://gemini-studio") ||
                    url.startsWith("http://10.0.2.2") ||
                    url.startsWith("http://localhost") ||
                    url.startsWith("http://192.168.")
                ) {
                    return false
                }

                // External links (e.g. Google Search Grounding sources) open in default Android browser
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                    return true
                } catch (e: Exception) {
                    return false
                }
            }
        }

        // Setup WebChromeClient (File Chooser + Permissions + Progress)
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                super.onProgressChanged(view, newProgress)
                if (newProgress in 1..99) {
                    binding.progressBar.visibility = View.VISIBLE
                    binding.progressBar.progress = newProgress
                } else {
                    binding.progressBar.visibility = View.GONE
                }
            }

            // HTML5 File Input Handler for Multimodal Image Attachments
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                openImagePicker()
                return true
            }

            // Web Audio (STT Microphone) and Camera permission handling
            override fun onPermissionRequest(request: PermissionRequest?) {
                if (request == null) return

                val permissionsToAsk = ArrayList<String>()
                for (res in request.resources) {
                    if (res == PermissionRequest.RESOURCE_AUDIO_CAPTURE) {
                        if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                            permissionsToAsk.add(Manifest.permission.RECORD_AUDIO)
                        }
                    } else if (res == PermissionRequest.RESOURCE_VIDEO_CAPTURE) {
                        if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                            permissionsToAsk.add(Manifest.permission.CAMERA)
                        }
                    }
                }

                if (permissionsToAsk.isNotEmpty()) {
                    pendingPermissionRequest = request
                    runtimePermissionLauncher.launch(permissionsToAsk.toTypedArray())
                } else {
                    request.grant(request.resources)
                }
            }
        }
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefreshLayout.setColorSchemeColors(
            ContextCompat.getColor(this, R.color.accent_cyan),
            ContextCompat.getColor(this, R.color.primary_indigo)
        )
        binding.swipeRefreshLayout.setProgressBackgroundColorSchemeColor(
            ContextCompat.getColor(this, R.color.bg_surface_card)
        )

        binding.swipeRefreshLayout.setOnRefreshListener {
            binding.webView.reload()
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (binding.webView.canGoBack()) {
                    binding.webView.goBack()
                } else {
                    // Double press or direct exit
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    private fun setupOfflineRetry() {
        binding.retryButton.setOnClickListener {
            binding.offlineContainer.visibility = View.GONE
            loadServerUrl(currentUrl)
        }
    }

    private fun loadServerUrl(url: String) {
        if (!isNetworkAvailable()) {
            showOfflineError()
            return
        }
        currentUrl = url
        binding.webView.loadUrl(url)
    }

    private fun showOfflineError() {
        binding.progressBar.visibility = View.GONE
        binding.swipeRefreshLayout.isRefreshing = false
        binding.offlineContainer.visibility = View.VISIBLE
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun openImagePicker() {
        val galleryIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
            type = "image/*"
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            addCategory(Intent.CATEGORY_OPENABLE)
        }

        var cameraIntent: Intent? = null
        try {
            val photoFile = createImageFile()
            cameraImageUri = FileProvider.getUriForFile(
                this,
                "${applicationContext.packageName}.fileprovider",
                photoFile
            )
            cameraIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri)
            }
        } catch (e: Exception) {
            cameraImageUri = null
        }

        val chooserIntent = Intent(Intent.ACTION_CHOOSER).apply {
            putExtra(Intent.EXTRA_INTENT, galleryIntent)
            putExtra(Intent.EXTRA_TITLE, "이미지 선택 또는 촬영")
            if (cameraIntent != null) {
                putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent))
            }
        }

        fileChooserLauncher.launch(chooserIntent)
    }

    @Throws(IOException::class)
    private fun createImageFile(): File {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES)
        return File.createTempFile("JPEG_${timeStamp}_", ".jpg", storageDir)
    }

    /**
     * Helper to switch between Production Cloud Run and Local Android Studio Emulator
     * Can be invoked via Long Click or Menu
     */
    fun showServerSwitchDialog() {
        val options = arrayOf(
            "1. Google Cloud Run 프로덕션 (기본)\n   $defaultProdUrl",
            "2. 로컬 에뮬레이터 (Node.js webApp)\n   $defaultEmulatorUrl"
        )

        AlertDialog.Builder(this)
            .setTitle("서버 연결 대상 선택")
            .setItems(options) { _, which ->
                val selectedUrl = if (which == 0) defaultProdUrl else defaultEmulatorUrl
                val prefs = getSharedPreferences("gemini_app_prefs", Context.MODE_PRIVATE)
                prefs.edit().putString("server_url", selectedUrl).apply()
                loadServerUrl(selectedUrl)
                Toast.makeText(this, "연결 대상 변경됨: $selectedUrl", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("취소", null)
            .show()
    }
}
