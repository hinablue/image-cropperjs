<?php

// Check if the request is a POST request
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get the raw POST data
    $json_data = file_get_contents('php://input');

    // Decode the JSON data
    $data = json_decode($json_data, true);

    // Check if the data is valid
    if ($data && isset($data['cropInfo'])) {
        $cropInfo = $data['cropInfo'];
        $originalImage = $data['originalImage'];

        // --- ImageMagick Command Generation ---
        // This is a conceptual example. You would replace 'input.jpg' and 'output.jpg'
        // with your actual file paths.
        $inputFile = 'path/to/your/input.jpg';
        $outputFile = 'path/to/your/output.jpg';

        // Start building the command
        $command = 'convert "' . $inputFile . '"';

        // 1. Rotation (if any)
        if (isset($cropInfo['rotate']) && $cropInfo['rotate'] > 0) {
            $command .= ' -rotate "' . $cropInfo['rotate'] . '"';
        }

        // 2. Cropping
        $command .= ' -crop ' . $cropInfo['width'] . 'x' . $cropInfo['height'] . '+' . $cropInfo['x'] . '+' . $cropInfo['y'];

        // 3. Add output file
        $command .= ' "' . $outputFile . '"';

        // --- Output ---
        // For demonstration, we'll just output the command and the received data.
        // In a real application, you would execute the command using shell_exec() or similar.

        header('Content-Type: application/json');
        echo json_encode([
            'status' => 'success',
            'message' => 'Imagick command generated successfully.',
            'imagick_command' => $command,
            'received_data' => $data
        ]);

    } else {
        // Invalid data
        header('Content-Type: application/json', true, 400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid JSON data received.']);
    }
} else {
    // Not a POST request
    header('Content-Type: text/plain');
    echo "This endpoint only accepts POST requests with JSON data.\n";
    echo "Please send the cropper data to this URL.";
}