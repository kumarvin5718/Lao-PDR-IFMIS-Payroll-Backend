package com.ifmis.payroll.controller.employeeMaster;

import com.ifmis.payroll.dto.EmployeeRequestDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/employees")
@RequiredArgsConstructor
public class EmployeeMasterController {


    @PostMapping
    public ResponseEntity<?> createEmployee(@Valid @RequestBody EmployeeRequestDto request) {
        return null;
    }
}