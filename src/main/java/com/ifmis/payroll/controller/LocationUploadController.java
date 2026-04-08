package com.ifmis.payroll.controller;

import com.ifmis.payroll.dto.LocationUploadResponseDto;
import com.ifmis.payroll.service.LocationUploadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/location")
@RequiredArgsConstructor
public class LocationUploadController {

    private final LocationUploadService locationUploadService;

    @PostMapping("/upload")
    public ResponseEntity<LocationUploadResponseDto> uploadLocations(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        LocationUploadResponseDto response = locationUploadService.uploadLocations(file);
        return ResponseEntity.ok(response);
    }
}
