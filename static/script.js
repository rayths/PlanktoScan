$(document).ready(function () {
    const $btn = $('.btn');
    const $start = $('.btn-start');
    const $home = $('.btn-back');
    const $fileInput = $('#file-image-upload');
    const $imageUploadInput = $('#image-upload');
    const $predictButton = $('.btn-predict-image');
    const $modelSelect = $('#deep-learning-model');
    const $llmSelect = $('#llm-model');
    const $loading = $('#load');
    const $transparant = $('#transparant-bg');

    let uploadedImagePath = '';

    // Hover effect
    $btn.hover(
        function () {
            const svg = $(this).find('svg path');
            $(this).data('timeout', setTimeout(() => {
                svg.css('fill', '#ffffff');
            }, 100));
        },
        function () {
            clearTimeout($(this).data('timeout'));
            $(this).find('svg path').css('fill', '#59a9d4');
        }
    );

    // Routing navigation
    $start.click(() => window.location.href = '/dashboard');
    $home.click(() => window.location.href = '/home');

    // Upload image
    $fileInput.on('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        $.ajax({
            url: '/upload',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: (data) => {
                uploadedImagePath = data.img_path;
                $imageUploadInput.val(file.name);
            },
            error: () => {
                swal({
                    title: "Error",
                    text: "Gagal mengunggah gambar.",
                    icon: "error",
                });
            }
        });
    });

    // Predict
    $predictButton.click(() => {
        if (!uploadedImagePath) {
            return swal({ text: "Silakan upload gambar terlebih dahulu.", icon: "error" });
        }

        const formData = new FormData();
        formData.append('img_path', uploadedImagePath);
        formData.append('model_option', $modelSelect.val());
        formData.append('llm_option', $llmSelect.val());

        $loading.show();
        $transparant.show();

        $.ajax({
            url: '/predict',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: (data) => {
                window.location.href = `/result/${data.result_id}`;
            },
            error: () => {
                $loading.hide();
                $transparant.hide();
                swal({ title: "Error", text: "Gagal memprediksi gambar.", icon: "error" });
            }
        });
    });
});
